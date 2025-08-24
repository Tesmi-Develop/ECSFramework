import { SyncData } from "@ecsframework/replicator";
import { Networking } from "@flamework/networking";
import { Entity } from "@rbxts/jecs";

interface ClientToServerEvents {
	OnReady: () => void;
	OnEntityConnect: (entity: Entity) => void;
}

interface ServerToClientEvents {
	OnSyncECSData: (payload: SyncData) => void;
}

interface ClientToServerFunctions {}

interface ServerToClientFunctions {}

export const GlobalEvents = Networking.createEvent<ClientToServerEvents, ServerToClientEvents>();
export const GlobalFunctions = Networking.createFunction<ClientToServerFunctions, ServerToClientFunctions>();

export const ClientEvents = GlobalEvents.createClient({});
export const ClientFunctions = GlobalFunctions.createClient({});
