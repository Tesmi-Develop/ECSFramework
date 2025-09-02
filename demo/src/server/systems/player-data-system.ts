import { BaseSystem, ECSSystem, InjectType, RobloxInstanceComponent, useEvent } from "@ecsframework/core";
import { SavingSystem } from "@ecsframework/player-data-handler";
import { Players } from "@rbxts/services";
import { ReadyPlayerTag } from "shared/components/on-ready-player";
import { PlayerProfile } from "server/player-profile";
import { PlayerTag } from "shared/components/player-tag";

@ECSSystem()
export class PlayerDataSystem extends BaseSystem {
	@InjectType
	private savingSystem!: SavingSystem;

	OnStartup(): void {
		this.savingSystem.SetProfileWrapper(PlayerProfile);
	}

	OnUpdate(): void {
		for (const [player] of useEvent(Players.PlayerAdded)) {
			const entity = this.SpawnEntity<[RobloxInstanceComponent, PlayerTag]>([
				{
					Instance: player,
				},
			]);

			this.savingSystem.LoadProfile(player, entity).then(() => {
				this.SetComponent<ReadyPlayerTag>(entity, {});
			});
		}

		for (const [player] of useEvent(Players.PlayerRemoving)) {
			this.savingSystem.CloseProfile(player);
		}
	}
}
