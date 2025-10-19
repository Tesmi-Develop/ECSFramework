import { BaseSystem, ComponentKey, ECSSystem, Entity } from "@ecsframework/core";
import { PrototypeHandler } from "@rbxts/prototype";
import { EntityPrototype } from "./entity-prototype";

@ECSSystem({
	Priority: math.huge,
})
export class EntityPrototypeSystem extends BaseSystem {
	public static Instance: EntityPrototypeSystem;
	private handler?: PrototypeHandler;

	OnStartup(): void {
		EntityPrototypeSystem.Instance = this;
	}

	public SetHandler(handler: PrototypeHandler) {
		this.handler = handler;
	}

	public GetHandler() {
		return this.handler;
	}

	private setupComponent(entity: Entity, component: object, name: string) {
		const key = this.GetComponentKeyByName(name)!;
		const newData = {};
		for (const [key, value] of pairs(component)) {
			newData[key as never] = value as never;
		}

		this.SetComponent(entity, newData, key as ComponentKey<unknown>);
	}

	private instantiate(prototype: EntityPrototype) {
		const entity = this.SpawnEntity();

		for (const [key, component] of prototype.Components) {
			this.setupComponent(entity, component, key);
		}

		return entity;
	}

	private validateHandler() {
		if (!this.handler) {
			throw "Prototype handler is not set";
		}
	}

	public TryInstantiate(prototypeId: string) {
		this.validateHandler();

		const [success, prototype] = this.handler!.TryIndex<EntityPrototype>(prototypeId);
		if (!success) {
			return [false, undefined] as const;
		}

		const entity = this.instantiate(prototype);
		return [true, entity] as const;
	}

	public Instantiate(prototypeId: string) {
		this.validateHandler();

		const [success, prototype] = this.handler!.TryIndex<EntityPrototype>(prototypeId);
		if (!success) {
			throw `Prototype ${prototypeId} does not exist`;
		}

		return this.instantiate(prototype);
	}
}
