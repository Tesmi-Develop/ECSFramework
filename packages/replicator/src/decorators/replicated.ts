import { DefineClassComponentMeta, RobloxInstanceComponent, Tag } from "@ecsframework/core";
import { Constructor } from "@flamework/core/out/utility";
import { Entity } from "@rbxts/jecs";
import { ReplicationSystem } from "../systems/replication-system";

export interface ReplicateOption<T> {
	resolvePlayerConnection?: (player: Player, entity: Entity, data: T, system: ReplicationSystem) => boolean;
}

export interface ReplicatedTag extends Tag {}

export function Replicated<T>(options: ReplicateOption<T> = {}) {
	return function (target: Constructor<T>) {
		DefineClassComponentMeta<ReplicatedTag>(target as never, options);
	};
}

Replicated()(RobloxInstanceComponent);
