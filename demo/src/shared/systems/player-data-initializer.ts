import { BaseSystem, ComponentKey, ECSSystem, Entity, InjectType } from "@ecsframework/core";
import { DependenciesContainer } from "@ecsframework/core";
import { SavedOption, SavedTag } from "@ecsframework/player-data-handler";
import { PlayerTag } from "shared/components/player-tag";

@ECSSystem()
export class PlayerDataInitializerSystem extends BaseSystem {
	@InjectType
	private container!: DependenciesContainer;

	private initPlayer(entity: Entity) {
		for (const componentId of this.Each<SavedTag>()) {
			const savedComponent = this.GetComponentKey<string>(componentId)!;
			const options = this.GetComponent<SavedTag>(componentId) as unknown as SavedOption<object>;

			if (this.HasComponent(entity, savedComponent as ComponentKey<unknown>)) {
				continue;
			}

			this.SetComponent(
				entity,
				options.OnCreate?.(this.world, this.container as never, this as never) ?? {},
				savedComponent as never,
			);
		}
	}

	OnStartup(): void {
		/*for (const entity of this.Each<PlayerTag>()) {
			this.initPlayer(entity);
		}*/
	}

	OnEffect(): void {
		/*for (const [entity, record] of this.QueryChange<PlayerTag>()) {
			if (record.new !== undefined && record.old === undefined) {
				this.initPlayer(entity);
			}
		}*/
	}
}
