import { DefineClassComponentMeta, Tag } from "@ecsframework/core";
import { Constructor } from "@flamework/core/out/utility";
import { Entity } from "@rbxts/jecs";

export interface ReplicateOption {
	resolvePlayerConnection?: (player: Player, entity: Entity, currentComponentKey: string) => boolean;
}

export interface ReplicatedTag extends Tag {}

export function Replicated(options: ReplicateOption = {}) {
	return function (target: Constructor) {
		DefineClassComponentMeta<ReplicatedTag>(target, options);
	};
}
