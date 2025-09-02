import { BaseSystem, ComponentKey, ECSSystem, Entity } from "@ecsframework/core";
import { Flamework } from "@flamework/core";

export interface PrototypeRef {
	Type: typeof PrototypeRefType;
	PrototypeId: string;
}

export interface ComponentData {
	Type: string;
	Data: {};
}

export interface EntityPrototype {
	Id: string;
	Tags?: string[];
	BasePrototypes?: string[];
	Components: ComponentData[];
}

const EntityPrototypeValidator = Flamework.createGuard<EntityPrototype>();
const PrototypeRefValidator = Flamework.createGuard<PrototypeRef>();
const PrototypeRefType = "$Ref";

@ECSSystem()
export class PrototypeSystem extends BaseSystem {
	private components = new Set(this.GetAllClassComponents().map((component) => `${component}`));
	private preCompilePrototypes = new Map<string, EntityPrototype>();
	private prototypes = new Map<string, EntityPrototype>();

	public ValidatePrototypeStructure(prototype: object): prototype is EntityPrototype {
		if (!EntityPrototypeValidator(prototype)) {
			throw "Invalid prototype";
		}

		if (this.preCompilePrototypes.has(prototype.Id) || this.prototypes.has(prototype.Id)) {
			throw `Prototype with id: ${prototype.Id}, already exists`;
		}

		for (const component of prototype.Components) {
			if (!this.components.has(component.Type)) {
				throw `Component ${component.Type} does not exist in prototype: ${prototype.Id}`;
			}

			if (component.Type === PrototypeRefType && !PrototypeRefValidator(component.Data)) {
				throw `Invalid prototype reference, prototype: ${prototype.Id}`;
			}
		}

		return true;
	}

	public RegisterPrototype(prototype: object) {
		if (!this.ValidatePrototypeStructure(prototype)) return;
		this.preCompilePrototypes.set(prototype.Id, prototype);
	}

	public CompitePrototypes() {
		for (const [id, prototype] of pairs(this.preCompilePrototypes)) {
			const clonedPrototype = table.clone(prototype);
			this.validateBasePrototypes(clonedPrototype);
			this.validateCircularDependency(clonedPrototype, { set: new Set([id]), array: [id] });
			this.validatePrototypeRefs(clonedPrototype);

			const baseComponents = this.getBasePrototypeComponents(clonedPrototype);
			const newComponents: ComponentData[] = [];
			const visitedComponents = new Map<string, ComponentData>();

			for (const baseComponent of baseComponents) {
				if (visitedComponents.has(baseComponent.Type)) {
					const data = visitedComponents.get(baseComponent.Type)!;

					for (const [key, value] of pairs(baseComponent.Data)) {
						data[key as never] = value as never;
					}

					continue;
				}

				const clone = table.clone(baseComponent);
				visitedComponents.set(baseComponent.Type, clone);
				newComponents.push(clone);
			}

			for (const baseComponent of prototype.Components) {
				if (visitedComponents.has(baseComponent.Type)) {
					const data = visitedComponents.get(baseComponent.Type)!;

					for (const [key, value] of pairs(baseComponent.Data)) {
						data[key as never] = value as never;
					}

					continue;
				}

				const clone = table.clone(baseComponent);
				visitedComponents.set(baseComponent.Type, clone);
				newComponents.push(clone);
			}

			clonedPrototype.Components = newComponents;
			this.prototypes.set(id, clonedPrototype);
		}

		this.preCompilePrototypes.clear();
	}

	public Instantiate(prototypeId: string) {
		const prototype = this.prototypes.get(prototypeId);
		if (!prototype) {
			throw `Prototype ${prototypeId} does not exist`;
		}

		return this.instantiate(prototype);
	}

	public TryInstantiate(prototypeId: string) {
		const prototype = this.prototypes.get(prototypeId);
		if (!prototype) {
			return [false, undefined] as const;
		}

		return [true, this.instantiate(prototype)] as const;
	}

	private resolveComponentValue(value: unknown) {
		if (!typeIs(value, "table")) return value;

		if (
			"Type" in value &&
			"PrototypeId" in value &&
			typeIs(value.PrototypeId, "string") &&
			value.Type === PrototypeRefType
		) {
			return this.instantiate(this.prototypes.get(value.PrototypeId)!);
		}

		return value;
	}

	private setupComponent(entity: Entity, component: ComponentData) {
		const key = this.GetComponentKeyByName(component.Type)!;
		const newData = {};
		for (const [key, value] of pairs(component.Data)) {
			newData[key as never] = this.resolveComponentValue(value) as never;
		}

		this.SetComponent(entity, newData, key as ComponentKey<unknown>);
	}

	private instantiate(prototype: EntityPrototype) {
		const entity = this.SpawnEntity();

		for (const component of prototype.Components) {
			this.setupComponent(entity, component);
		}

		return entity;
	}

	private getBasePrototypeComponents(prototype: EntityPrototype, components: ComponentData[] = []) {
		if (!prototype.BasePrototypes) return components;

		for (const basePrototypeId of prototype.BasePrototypes) {
			const basePrototype = this.prototypes.get(basePrototypeId)!;
			this.getBasePrototypeComponents(basePrototype, components);
		}

		return components;
	}

	private validateCircularDependency(
		prototype: EntityPrototype,
		visited: {
			set: Set<string>;
			array: Array<string>;
		},
	) {
		if (!prototype.BasePrototypes) return;

		for (const basePrototypeId of prototype.BasePrototypes) {
			if (visited.set.has(basePrototypeId)) {
				visited.array.push(basePrototypeId);
				const str = visited.array.join("  ⇒ ");
				throw `Detected a circular dependency chain: ${str}`;
			}

			visited.set.add(basePrototypeId);
			visited.array.push(basePrototypeId);
		}
	}

	private validateBasePrototypes(prototype: EntityPrototype) {
		if (!prototype.BasePrototypes) return;

		for (const basePrototypeId of prototype.BasePrototypes) {
			if (!this.prototypes.has(basePrototypeId) && !this.preCompilePrototypes.has(basePrototypeId)) {
				throw `Base prototype ${basePrototypeId} does not exist, prototype: ${prototype.Id}`;
			}

			if (basePrototypeId === prototype.Id) {
				throw `Prototype: ${prototype.Id} cannot be a base of itself :|`;
			}
		}
	}

	private validatePrototypeRefs(prototype: EntityPrototype) {
		for (const component of prototype.Components) {
			if (component.Type === PrototypeRefType) {
				const ref = component.Data as PrototypeRef;
				if (!this.prototypes.has(ref.PrototypeId) && !this.preCompilePrototypes.has(ref.PrototypeId)) {
					throw `Prototype reference ${ref.PrototypeId} does not exist, prototype: ${prototype.Id}`;
				}
			}
		}
	}
}
