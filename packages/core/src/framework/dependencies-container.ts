import { Modding } from "@flamework/core";
import { Constructor } from "@flamework/core/out/utility";
import { GetClassName, getDeferredConstructor, GetIdentifier, VoidCallback } from "./utilities";
import { GetInjectTypes } from "./decorators/inject-type";

export class DependenciesContainer {
	private factories = new Map<string, (context: unknown) => unknown>();
	private instances = new Map<object, object>();

	private wrapConstructorInFactory(ctor: Constructor) {
		return () => {
			if (this.instances.has(ctor)) {
				return this.instances.get(ctor)!;
			}

			const instance = this.Instantiate(ctor);
			this.instances.set(ctor, instance);

			return instance;
		};
	}

	/** @metadata macro */
	public Register<T extends object>(ctor: Constructor<T>, spec?: Modding.Intrinsic<"symbol-id", [T], string>): void;
	/** @metadata macro */
	public Register<T>(factory: (context: unknown) => T, spec?: Modding.Intrinsic<"symbol-id", [T], string>): void;
	public Register<T>(
		factoryOrCtor: ((context: unknown) => T) | Constructor<T>,
		spec?: Modding.Intrinsic<"symbol-id", [T], string>,
	) {
		assert(spec);

		const factory = typeIs(factoryOrCtor, "function")
			? factoryOrCtor
			: this.wrapConstructorInFactory(factoryOrCtor as never);

		this.factories.set(`${spec}`, factory);
	}

	/** @metadata macro */
	public Unregister<T>(spec?: Modding.Generic<T, "id">) {
		assert(spec);
		this.factories.delete(spec);
	}

	private resolve(spec: string, ctor?: Constructor) {
		let result = this.factories.get(spec)?.(ctor);
		assert(result, `No factory for ${spec}`);

		return result;
	}

	/** @metadata macro */
	public Resolve<T>(spec?: Modding.Generic<T, "id">, ctor?: Constructor) {
		return this.resolve(spec as never, ctor);
	}

	public Inject(instance: object, handle?: (injecting: unknown) => void) {
		const injectedTypes = GetInjectTypes(instance);
		if (!injectedTypes) return;

		injectedTypes.forEach((specType, fieldName) => {
			const injectedType = this.resolve(specType as never, getmetatable(instance) as never) as never;
			handle?.(injectedType);

			instance[fieldName as never] = injectedType;
		});
	}

	public Instantiate<T extends object>(ctor: Constructor<T>, ...args: ConstructorParameters<Constructor<T>>) {
		const [instance, construct] = getDeferredConstructor<T>(ctor);

		this.Inject(instance as object);
		construct(...args);

		return instance as T;
	}

	public InstantiateGroup(ctors: Constructor[], isRegister = false) {
		const injects: VoidCallback[] = [];
		const constructructs: VoidCallback[] = [];
		const instances: object[] = [];

		ctors.forEach((ctor) => {
			const [instance, construct, inject] = this.InstantiateWithoutConstruct(ctor);
			instances.push(instance as never);
			injects.push(inject);
			constructructs.push(construct);
		});

		if (isRegister) {
			instances.forEach((instance) => {
				const id = GetIdentifier(instance as never);
				assert(id, `No identifier for ${GetClassName(instance)}`);
				this.Register(() => instance, id as never);
			});
		}

		injects.forEach((inject) => inject());
		constructructs.forEach((construct) => construct());

		return instances;
	}

	public InstantiateWithoutConstruct<T extends object>(ctor: Constructor<T>) {
		const [instance, construct] = getDeferredConstructor<T>(ctor);
		return [instance as T, construct, () => this.Inject(instance as object)] as const;
	}

	public Clear() {
		this.factories.clear();
		this.instances.clear();
	}
}
