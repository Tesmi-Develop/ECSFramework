import {
	BaseSystem,
	ECSSystem,
	InjectType,
	RobloxInstanceComponent,
	RobloxInstanceSystem,
	useAdded,
} from "@ecsframework/core";
import { ClickPartComponent } from "server/components/click-part-component";
import { PlayerDataComponent } from "shared/components/player-data";

@ECSSystem()
export class ClickPartSystem extends BaseSystem {
	@InjectType
	private robloxInstanceSystem!: RobloxInstanceSystem;

	OnEffect(): void {
		for (const [entity, data] of useAdded<ClickPartComponent>()) {
			const instanceData = this.GetComponent<RobloxInstanceComponent>(entity)!;
			instanceData.Instance.FindFirstChildOfClass("ClickDetector")?.MouseClick.Connect((player) => {
				const entity = this.robloxInstanceSystem.GetEntityFromInstance(player)!;
				this.MutateComponent<PlayerDataComponent>(entity, (draft) => {
					draft.Money += data.Amount;
				});
			});
		}
	}
}
