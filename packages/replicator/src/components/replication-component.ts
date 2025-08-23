import { ECSComponent, RunContext } from "@ecsframework/core";

export const enum ReplicationType {
	OnFirstPlayerConnection,
	PerPlayerConnection,
}

export interface ReplicationData {
	connectedPlayers: Set<Player>;
}

@ECSComponent({ RunContext: RunContext.Server })
export class ReplicationComponent {
	public replicationType: ReplicationType = ReplicationType.OnFirstPlayerConnection;
	public connectedPlayersByComponent = new Map<string, ReplicationData>(); // ComponentKey -> ReplicationData
}
