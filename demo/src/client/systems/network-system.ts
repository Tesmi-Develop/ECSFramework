import { BaseSystem, ECSSystem, InjectType } from "@ecsframework/core";
import { ReceiveReplicationSystem } from "@ecsframework/replicator";
import { Events } from "client/network";

@ECSSystem({
	Priority: -math.huge,
})
export class NetworkSystem extends BaseSystem {
	@InjectType
	private replicationSystem!: ReceiveReplicationSystem;

	OnStartup(): void {
		Events.OnSyncECSData.connect((data) => {
			this.replicationSystem.Sync(data);
		});

		this.replicationSystem.OnEntityConnect.Connect((entity) => {
			Events.OnEntityConnect.fire(entity);
		});

		Events.OnReady.fire();
	}
}
