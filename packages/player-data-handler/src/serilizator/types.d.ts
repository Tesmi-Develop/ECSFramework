import { Entity } from "@rbxts/jecs";

export interface EntityRef {
	__type: "EntityRef";
	EntityId: Entity;
}
