import { BaseSystem } from "@ecsframework/core";
import { DependenciesContainer } from "@ecsframework/core/out/framework/dependencies-container";
import { World } from "@rbxts/jecs";
import { t } from "@rbxts/t";

export interface SavedOption<T extends object> {
	Migrations?: ((data: unknown) => unknown)[];
	Guard?: t.check<unknown>;
	OnCreate?: (world: World, container: DependenciesContainer, system: BaseSystem) => T;
}
