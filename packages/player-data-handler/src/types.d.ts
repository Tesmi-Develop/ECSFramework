import { BaseSystem } from "@ecsframework/core";
import { DependenciesContainer } from "@ecsframework/core";
import { World } from "@rbxts/jecs";
import { t } from "@rbxts/t";

export interface SavedData<T extends object = object> {
	Migrations?: ((data: unknown) => unknown)[];
	Guard?: t.check<unknown>;
	OnCreate?: (world: World, container: DependenciesContainer, system: BaseSystem) => T;
}
