import { ECSComponent, RobloxInstanceComponent } from "@ecsframework/core";
import { Saved } from "@ecsframework/player-data-handler";
import { Replicated } from "@ecsframework/replicator";

@Replicated({
	resolvePlayerConnection: (player, entity, data, system) => {
		const instanceData = system.GetComponent<RobloxInstanceComponent>(entity);
		if (!instanceData) return false;
		return instanceData.Instance === player;
	},
})
@Saved()
@ECSComponent()
export class PlayerDataComponent {
	public Money = 0;
}
