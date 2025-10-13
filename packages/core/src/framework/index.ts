import { Flamework, Modding, Reflect } from "@flamework/core";
import { Constructor } from "@flamework/core/out/utility";
import { Entity, Name, world, World } from "@rbxts/jecs";
import { RunService } from "@rbxts/services";
import { BaseSystem } from "./base-system";
import { ECSComponentOptions } from "./decorators/component";
import { SystemOptions } from "./decorators/system";
import { DependenciesContainer } from "./dependencies-container";
import { start } from "./flamecs";
import { hookListeners, initWorld, reserve, scheduleComponent } from "./flamecs/registry";
import { Signal } from "./flamecs/signal";
import { ApplyComponentMeta, GetIdentifier, RunContext } from "./utilities";
import { Phase, Scheduler } from "@rbxts/planck";
import planckRunService, { Phases } from "@rbxts/planck-runservice";

interface SystemInfo {
	Instance: BaseSystem;
	OnStartup?: (context: object) => void;
	OnEffect?: (context: object) => void;
	OnUpdate?: (context: object, dt: number) => void;
	Options: SystemOptions;
}

function getCachedMethod<T extends Callback>(instance: object, methodName: string, excludeParentCtor?: object) {
	const methodCallback = (instance as Record<string, T>)[methodName];
	if (!excludeParentCtor) return methodCallback;

	const baseMethodCallback = (excludeParentCtor as unknown as Record<string, T>)[methodName];
	return methodCallback === baseMethodCallback ? undefined : methodCallback;
}

export class ECSFramework {
	private static IsApplyMeta = false;
	private systems: SystemInfo[] = [];
	private canCallEffect = true;
	private isStarted = false;
	private baseSystemCtor!: Constructor<BaseSystem>;
	public readonly componentsMap: ReadonlyMap<string, Constructor> = new Map();
	public readonly ComponentsByName: ReadonlyMap<string, string> = new Map(); // ComponentName -> ComponentId
	private components: Constructor[] = [];
	private world!: World;
	private onEffectPhase = new Phase("OnEffect");
	public readonly Scheduler = new Scheduler();
	public readonly signals = {
		added: new ReadonlyMap<Entity, Signal<[Entity, unknown]>>(),
		changed: new ReadonlyMap<Entity, Signal<[Entity, unknown]>>(),
		removed: new ReadonlyMap<Entity, Signal<[Entity]>>(),
	};

	constructor(public readonly Container: DependenciesContainer = new DependenciesContainer()) {
		this.baseSystemCtor = Modding.getObjectFromId(Flamework.id<BaseSystem>()) as Constructor<BaseSystem>;

		Container.Register<ECSFramework>(() => this);
		Container.Register<DependenciesContainer>(() => Container);

		this.GetAllComponents();
		this.initComponentMetadata();
		this.world = world();
		this.initComponents();
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
					OnStartup: getCachedMethod(instance, "OnStartup", BaseSystem),
					OnEffect: getCachedMethod(instance, "OnEffect", BaseSystem),
					OnUpdate: getCachedMethod(instance, "OnUpdate", BaseSystem),
					Options: options,
				};
			})
			.filterUndefined()
			.sort((a, b) => (a.Options.Priority ?? 1) > (b.Options.Priority ?? 1));
	}

	private invokeStartup() {
		for (const system of this.systems) {
			if (system.OnStartup === undefined) continue;

			this.Scheduler.addSystem({
				name: `${getmetatable(system.Instance)}-Startup`,
				phase: Phase.Startup,
				system: () => {
					start(system.Instance.__hookStates, system.Instance, this.world, () =>
						system.OnStartup!(system.Instance),
					);
				},
			});
		}
	}

	private initUpdate() {
		for (const system of this.systems) {
			if (system.OnUpdate === undefined) continue;

			this.Scheduler.addSystem({
				name: `${getmetatable(system.Instance)}-Update`,
				phase: Phases.Update,
				system: () => {
					const dt = this.Scheduler.getDeltaTime();
					start(system.Instance.__hookStates, system.Instance, this.world, () =>
						system.OnUpdate!(system.Instance, dt),
					);
				},
			});
		}
	}

	private initComponentMetadata() {
		if (ECSFramework.IsApplyMeta) return;
		this.components.forEach((component) => {
			const runtimeId = Reflect.getOwnMetadata<Entity>(component, "ECSFramework:Id");
			if (runtimeId === undefined) {
				throw `Component ${component} does not have a runtime id.`;
			}

			const identifier = GetIdentifier(component);
			ApplyComponentMeta(runtimeId, identifier, this.world);
		});
		ECSFramework.IsApplyMeta = true;
	}

	private initComponents() {
		this.components.forEach((component) => {
			const runtimeId = Reflect.getOwnMetadata<Entity>(component, "ECSFramework:Id");
			if (runtimeId === undefined) {
				throw `Component ${component} does not have a runtime id.`;
			}

			reserve(this.world, runtimeId, GetIdentifier(component) as never);
			this.world.set(runtimeId, Name, `${component}`);
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

			this.Scheduler.run(this.onEffectPhase);
		});

		const reactives: Entity[] = this.GetAllComponents()
			.map((obj) => {
				const unaffectable = Reflect.getOwnMetadata<boolean>(obj, "ECSFramework:Unaffectable") ?? false;
				const id = Reflect.getOwnMetadata<Entity>(obj, "ECSFramework:Id");

				return !unaffectable ? id : undefined;
			})
			.filterUndefined();

		for (const system of this.systems) {
			if (system.OnEffect === undefined) continue;
			this.Scheduler.addSystem(
				{
					name: `${getmetatable(system.Instance)}-OnEffect`,
					phase: this.onEffectPhase,
					system: () => {
						start(system.Instance.__hookStates, system.Instance, this.world, () =>
							system.OnEffect!(system.Instance),
						);
					},
				},
				this.onEffectPhase,
			);
		}

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

		this.Scheduler.insert(this.onEffectPhase);
		this.Scheduler.addPlugin(new planckRunService.Plugin());

		// Init
		initWorld(this.world);
		this.initSystems();
		this.initUpdate();
		this.initEvents();

		// Call events
		this.invokeStartup();
	}
}
