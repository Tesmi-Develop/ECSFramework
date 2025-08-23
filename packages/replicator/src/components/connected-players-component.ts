import { ECSComponent, RunContext } from "@ecsframework/core";

@ECSComponent({ RunContext: RunContext.Server })
export class ConnectedPlayersComponent {
	public connectedPlayers = new Set<Player>();
}
