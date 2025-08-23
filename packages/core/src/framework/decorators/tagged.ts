import { Constructor } from "@flamework/core/out/utility";
import { World } from "@rbxts/jecs";
import { DependenciesContainer } from "../dependencies-container";
import { Tag } from "../flamecs";
import { DefineClassComponentMeta } from "../utilities";

export interface TaggedOptions<T> {
	Tag: string;
	OnCreateData: (instance: Instance, world: World, container: DependenciesContainer) => Partial<T>;
}

export interface TaggedInstance extends Tag {}

export function Tagged<T>(options: TaggedOptions<T>) {
	return function (target: Constructor<T>) {
		DefineClassComponentMeta<TaggedInstance>(target as never, options);
	};
}
