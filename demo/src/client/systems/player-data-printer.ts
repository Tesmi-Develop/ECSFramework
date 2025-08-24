import { BaseSystem, ECSSystem, QueryChange } from "@ecsframework/core";
import { PlayerDataComponent } from "shared/components/player-data";

@ECSSystem()
export class PlayerDataSystem extends BaseSystem {
	OnEffect(): void {
		for (const [entity, data] of QueryChange<PlayerDataComponent>()) {
			print(data.new?.Money);
		}
	}
}
