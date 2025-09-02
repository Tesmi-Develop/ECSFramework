import { Entity, Id, Query } from "@rbxts/jecs";
import { DestroyComponent } from "../components/destroyed-component";
import { useHookState, useSystem, useWorld } from "../flamecs";
import { VoidCallback } from "../utilities";
import { ComponentKey } from "../flamecs/registry";
import { Modding } from "@flamework/core";

interface QueryChangeStorage<T> {
	componentTypeUd: string;
	prevEntityDatas: Map<Entity, QueryRecord<T>>;
	changes: Return<T>[];
	connections: VoidCallback[];
}

export interface QueryRecord<T> {
	new?: T;
	old?: T;
}

type Return<T> = [entity: Entity, record: QueryRecord<T>, isDestroyedEntity: boolean];

/** @metadata macro */
export function QueryChange<T>(componentTypeUd?: ComponentKey<T>, key?: Modding.Caller<"uuid">) {
	const storage = useHookState<QueryChangeStorage<T>>(key!, componentTypeUd, () => false);
	const world = useWorld();
	const system = useSystem();

	if (!storage.componentTypeUd) {
		storage.componentTypeUd = componentTypeUd!;

		const componentId = system.GetComponentId(componentTypeUd as ComponentKey<unknown>) as Entity<unknown>;
		const query = world.query(componentId) as Query<[Id<T>]>;

		storage.connections?.forEach((disconnect) => disconnect());
		storage.connections = [];
		storage.changes = [];
		storage.prevEntityDatas = new Map();

		storage.connections.push(
			world.added(componentId, (entity, _, data) => {
				const record: QueryRecord<T> = {
					old: undefined,
					new: data as T,
				};

				storage.changes.push([entity, record, false]);
			}),
		);

		storage.connections.push(
			world.changed(componentId, (entity, _, data) => {
				const prevData = storage.prevEntityDatas.get(entity);
				if (prevData?.new === data) return;

				if (prevData) storage.changes.push([entity, { old: prevData.new, new: data as T }, false]);
				storage.prevEntityDatas.set(entity, data as never);
			}),
		);

		storage.connections.push(
			world.removed(componentId, (entity) => {
				const prevData = storage.prevEntityDatas.get(entity);
				storage.changes.push([
					entity,
					{ old: prevData as T, new: undefined },
					system.HasComponent<DestroyComponent>(entity),
				]);
			}),
		);

		const iter = query.iter();

		return (() => {
			const [entity, componentData] = iter();
			if (componentData === undefined) return;
			storage.prevEntityDatas.set(entity, componentData as never);

			return [entity, { new: componentData, old: undefined }, false] as [Entity, QueryRecord<T>, boolean];
		}) as IterableFunction<Return<T>>;
	}

	return (() => {
		const result = storage.changes.shift();
		if (result === undefined) return;

		if (!storage.prevEntityDatas.has(result[0]) && result[1].new) {
			storage.prevEntityDatas.set(result[0], result[1].new as never);
		}

		return result;
	}) as IterableFunction<Return<T>>;
}
