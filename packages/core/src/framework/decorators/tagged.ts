import { Constructor } from "@flamework/core/out/utility";
import { World } from "@rbxts/jecs";
import { DependenciesContainer } from "../dependencies-container";
import { Tag } from "../flamecs";
import { DefineComponentMeta, GetIdentifier } from "../utilities";

export interface TaggedInstance<T> {
	Tag: string;
	OnCreateData?: (instance: Instance, world: World, container: DependenciesContainer) => Partial<T>;
}

export function Tagged<T>(options: TaggedInstance<T>) {
	return function (target: Constructor<T>) {
		DefineComponentMeta<TaggedInstance<unknown>>(GetIdentifier(target), options);
	};
}
