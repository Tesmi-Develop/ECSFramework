import { Flamework, Modding, Reflect } from "@flamework/core";
import { Constructor } from "@flamework/core/out/utility";
import { Entity, world, World } from "@rbxts/jecs";
import { RunService } from "@rbxts/services";
import { BaseSystem } from "./base-system";
import { ECSComponentOptions } from "./decorators/component";
import { SystemOptions } from "./decorators/system";
import { DependenciesContainer } from "./dependencies-container";
import { start } from "./flamecs";
import { hookListeners, initWorld, reserve, scheduleComponent } from "./flamecs/registry";
import { Signal } from "./flamecs/signal";
import { ApplyClassComponentMeta, GetIdentifier, RunContext } from "./utilities";

interface SystemInfo {
	Instance: BaseSystem;
	OnStartup: (context: object) => void;
	OnEffect: (context: object) => void;
	OnUpdate: (context: object, dt: number) => void;
	Options: SystemOptions;
}

function getCachedMethod<T extends Callback>(instance: object, methodName: string) {
	return (instance as Record<string, T>)[methodName];
}

export class ECSFramework {
	private systems: SystemInfo[] = [];
	private canCallEffect = true;
	private isStarted = false;
	private baseSystemCtor!: Constructor<BaseSystem>;
	public readonly componentsMap: ReadonlyMap<string, Constructor> = new Map();
	public readonly ComponentsByName: ReadonlyMap<string, string> = new Map(); // ComponentName -> ComponentId
	private components: Constructor[] = [];
	private world!: World;
	public readonly signals = {
		added: new ReadonlyMap<Entity, Signal<[Entity, unknown]>>(),
		changed: new ReadonlyMap<Entity, Signal<[Entity, unknown]>>(),
		removed: new ReadonlyMap<Entity, Signal<[Entity]>>(),
	};

	constructor(public readonly Container: DependenciesContainer = new DependenciesContainer()) {
		this.baseSystemCtor = Modding.getObjectFromId(Flamework.id<BaseSystem>()) as Constructor<BaseSystem>;

		Container.Register<ECSFramework>(() => this);
		Container.Register<DependenciesContainer>(() => Container);

		this.initComponents();
		this.world = world();
		this.initComponentLifecycles();

		Container.Register<World>(() => this.world);
	}

	public GetAllComponents() {
		if (this.componentsMap.size() > 0) return this.components;

		this.components =
			Reflect.getOwnMetadata<Constructor[]>(this.baseSystemCtor, "ECSFramework:Components")
				?.map((ctor) => {
					const options = Reflect.getOwnMetadata<ECSComponentOptions>(ctor, "ECSFramework:ComponentOptions");
					if (!options) {
						warn(`Component ${ctor} is missing ECSComponentOptions.`);
						return;
					}

					if (
						options.RunContext !== undefined &&
						options.RunContext !== RunContext.Shared &&
						(RunService.IsServer() ? RunContext.Server : RunContext.Client) !== options.RunContext
					)
						return;

					(this.componentsMap as Map<string, Constructor>).set(GetIdentifier(ctor), ctor);
					(this.ComponentsByName as Map<string, string>).set(`${ctor}`, GetIdentifier(ctor));
					return ctor;
				})
				.filterUndefined() ?? [];

		return this.components;
	}

	public GetComponentKeyByName(name: string) {
		return this.ComponentsByName.get(name);
	}

	private initSystems() {
		const systems: Constructor[] = Reflect.getMetadata(this.baseSystemCtor, "ECSFramework:Systems") ?? [];
		this.systems = this.Container.InstantiateGroup(systems, true)
			.map((instance): SystemInfo | undefined => {
				const options =
					Reflect.getOwnMetadata<SystemOptions>(getmetatable(instance) as object, "ECSFramework:Options") ??
					{};

				if (
					options.RunContext !== undefined &&
					options.RunContext !== RunContext.Shared &&
					(RunService.IsServer() ? RunContext.Server : RunContext.Client) !== options.RunContext
				)
					return;

				return {
					Instance: instance as BaseSystem,
					OnStartup: getCachedMethod(instance, "OnStartup"),
					OnEffect: getCachedMethod(instance, "OnEffect"),
					OnUpdate: getCachedMethod(instance, "OnUpdate"),
					Options: options,
				};
			})
			.filterUndefined()
			.sort((a, b) => (a.Options.Priority ?? 1) > (b.Options.Priority ?? 1));
	}

	private invokeStartup() {
		this.systems.forEach((system) => {
			start(system.Instance.__hookStates, system.Instance, this.world, () => system.OnStartup(system.Instance));
		});
	}

	private initUpdate() {
		RunService.Heartbeat.Connect((dt) => {
			for (const system of this.systems) {
				start(system.Instance.__hookStates, system.Instance, this.world, () =>
					system.OnUpdate(system.Instance, dt),
				);
			}
		});
	}

	private initComponents() {
		this.GetAllComponents().forEach((component) => {
			const runtimeId = Reflect.getOwnMetadata<Entity>(component, "ECSFramework:Id");
			if (runtimeId === undefined) {
				throw `Component ${component} does not have a runtime id.`;
			}

			reserve(this.world, runtimeId, GetIdentifier(component) as never);
			ApplyClassComponentMeta(component, runtimeId);
		});
	}

	private initComponentLifecycles() {
		scheduleComponent.forEach((component) => {
			hookListeners(this.world, component);
		});
	}

	private initEvents() {
		RunService.Heartbeat.Connect(() => {
			if (!this.canCallEffect) return;
			this.canCallEffect = false;

			for (const system of this.systems) {
				start(system.Instance.__hookStates, system.Instance, this.world, () =>
					system.OnEffect(system.Instance),
				);
			}
		});

		const reactives: Entity[] = this.GetAllComponents()
			.map((obj) => {
				const unaffectable = Reflect.getOwnMetadata<boolean>(obj, "ECSFramework:Unaffectable") ?? false;
				const id = Reflect.getOwnMetadata<Entity>(obj, "ECSFramework:Id");

				return !unaffectable ? id : undefined;
			})
			.filterUndefined();

		for (const ct of reactives) {
			this.world.added(ct, () => {
				this.canCallEffect = true;
			});

			this.world.changed(ct, () => {
				this.canCallEffect = true;
			});

			this.world.removed(ct, () => {
				this.canCallEffect = true;
			});
		}
	}

	public Start() {
		if (this.isStarted) return;
		this.isStarted = true;

		// Init
		initWorld(this.world);
		this.initSystems();
		this.initUpdate();
		this.initEvents();

		// Call events
		this.invokeStartup();
	}
}
