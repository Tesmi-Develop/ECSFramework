import { Flamework } from "@flamework/core";
import { Component, Entity, Name, World } from "@rbxts/jecs";
import { EntityRef } from "../types";
import { registerTransformer } from "..";
import { BaseSystem } from "@ecsframework/core";
import { SavedData, SerializableComponent } from "../../types";

const guard = Flamework.createGuard<EntityRef>();

export function EntityTransformerSerialize(data: unknown, recursiveCallback: (data: unknown) => unknown, someData: {}) {
	if (!("World" in someData) || !typeIs(someData.World, "table") || !("System" in someData)) return data;

	const world = someData.World as World;
	const system = someData.System as BaseSystem;
	if (!guard(data) || !world.exists(data.EntityId)) return data;

	const components = new Map<string, unknown>();
	(components as never as { __type: "EntityRef" }).__type = "EntityRef";

	for (const componentId of system.Each<SerializableComponent>()) {
		if (!world.has(data.EntityId, componentId)) continue;

		const component = world.get(data.EntityId, componentId);
		const name = world.get(componentId as Entity, Name);
		if (!name) continue;

		components.set(name, recursiveCallback(component));
	}

	for (const componentId of system.Each<SavedData>()) {
		if (!world.has(data.EntityId, componentId)) continue;

		const component = world.get(data.EntityId, componentId);
		const name = world.get(componentId as Entity, Name);
		if (!name) continue;

		components.set(name, recursiveCallback(component));
	}

	return components;
}

function findComponentByName(name: string, world: World) {
	for (const [component, foundName] of world.query(Name)) {
		if (foundName === name) return component;
	}
}

export function EntityTransformerDeserialize(
	data: unknown,
	recursiveCallback: (data: unknown) => unknown,
	someData: {},
) {
	if (!("World" in someData) || !typeIs(someData.World, "table")) return data;

	const world = someData.World as World;
	if (!typeIs(data, "table") || !("__type" in data) || data.__type !== "EntityRef") return data;

	const newEntity = world.entity();
	const result: EntityRef = {
		__type: "EntityRef",
		EntityId: newEntity,
	};

	for (const [key, componentData] of pairs(data)) {
		if (key === "__type") continue;

		const componentId = findComponentByName(key, world);
		if (componentId === undefined) {
			warn(`[EntityTransformer]: Could not find component with name ${key}`);
			continue;
		}

		world.set(newEntity, componentId, recursiveCallback(componentData));
	}

	return result;
}

registerTransformer(
	EntityTransformerSerialize,
	EntityTransformerDeserialize,
	(data) => guard(data),
	(data) => typeIs(data, "table") && "__type" in data && data.__type === "EntityRef",
);
