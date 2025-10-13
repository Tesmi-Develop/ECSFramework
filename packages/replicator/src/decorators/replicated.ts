import { DefineClassComponentMeta, RobloxInstanceComponent, Tag } from "@ecsframework/core";
import { Constructor } from "@flamework/core/out/utility";
import { Entity } from "@rbxts/jecs";
import { ReplicationSystem } from "../systems/replication-system";

export interface ReplicatedTag<T> {
	resolvePlayerConnection?: (player: Player, entity: Entity, data: T, system: ReplicationSystem) => boolean;
}

export function Replicated<T>(options: ReplicatedTag<T> = {}) {
	return function (target: Constructor<T>) {
		DefineClassComponentMeta<ReplicatedTag<unknown>>(target as never, options);
	};
}

Replicated()(RobloxInstanceComponent);
