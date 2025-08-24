import { produce } from "@rbxts/immut";
import { Entity } from "@rbxts/jecs";
import { Players } from "@rbxts/services";
import Signal from "@rbxts/signal";
import { ConnectedPlayersComponent } from "../components/connected-players-component";
import { ReplicationComponent, ReplicationData, ReplicationType } from "../components/replication-component";
import { ReplicatedTag, ReplicateOption } from "../decorators/replicated";
import patch from "../patch";
import { SyncData } from "../types";
import {
	BaseSystem,
	ComponentKey,
	ECSSystem,
	QueryRecord,
	RobloxInstanceComponent,
	RunContext,
	useEvent,
} from "@ecsframework/core";

@ECSSystem({
	RunContext: RunContext.Server,
})
export class ReplicationSystem extends BaseSystem {
	public readonly OnSync = new Signal<(player: Player, data: SyncData) => void>();
	private connectedPlayersEntity!: Entity;
	private networkComponents: string[] = [];

	public ConnectPlayerOnFirstConnection(player: Player): void {
		const playerData: SyncData = new Map();
		this.addConnectedPlayer(player);

		for (const entity of this.Each<ReplicationComponent>()) {
			const replicationComponent = this.GetComponent<ReplicationComponent>(entity)!;
			if (replicationComponent.replicationType !== ReplicationType.OnFirstPlayerConnection) continue;

			for (const component of this.networkComponents) {
				const data = this.GetComponent(entity, component as ComponentKey<unknown>);
				if (data === undefined) continue;

				const replicationData = this.getReplicationData(entity, component as ComponentKey<unknown>);
				if (replicationData === undefined || replicationData.connectedPlayers.has(player)) continue;

				this.setReplicationData(
					entity,
					component as ComponentKey<unknown>,
					produce(replicationData, (draft) => {
						draft.connectedPlayers.add(player);
					}),
				);

				const componentContainer = (playerData.get(tostring(entity)) ?? new Map()) as Map<
					ComponentKey<unknown>,
					{ data: unknown; payloadType: "init" | "patch" }
				>;
				playerData.set(tostring(entity), componentContainer);
				componentContainer.set(component as ComponentKey<unknown>, { payloadType: "init", data });
			}
		}

		if (playerData.isEmpty()) return;
		this.OnSync.Fire(player, playerData);
	}

	public ConnectPlayerToEntity(player: Player, entity: Entity): void {
		const playerData: SyncData = new Map();

		const replicationData = this.GetComponent<ReplicationComponent>(entity);
		if (replicationData === undefined) return;

		for (const componentKey of this.networkComponents) {
			const componentData = this.GetComponent(entity, componentKey as ComponentKey<unknown>);
			if (componentData === undefined) return;

			const replicationComponent = this.getReplicationData(entity, componentKey as ComponentKey<unknown>);
			if (replicationComponent === undefined || replicationComponent.connectedPlayers.has(player)) return;

			const replicationOption = this.GetComponent<ReplicatedTag>(
				this.GetComponentId(componentKey as ComponentKey<unknown>) as Entity,
			) as unknown as ReplicateOption<unknown>;

			if (
				replicationOption.resolvePlayerConnection &&
				!replicationOption.resolvePlayerConnection(player, entity, componentData, this)
			)
				return;

			this.setReplicationData(
				entity,
				componentKey as ComponentKey<unknown>,
				produce(replicationComponent, (draft) => {
					draft.connectedPlayers.add(player);
				}),
			);

			const componentContainer = (playerData.get(tostring(entity)) ?? new Map()) as Map<
				ComponentKey<unknown>,
				{ data: unknown; payloadType: "init" | "patch" }
			>;
			playerData.set(tostring(entity), componentContainer);
			componentContainer.set(componentKey as ComponentKey<unknown>, { payloadType: "init", data: componentData });
		}

		this.OnSync.Fire(player, playerData);
	}

	private prepareAddedEntitySyncData(
		entity: Entity,
		componentKey: ComponentKey<unknown>,
		playerPayload: Map<Player, SyncData>,
	): void {
		const replicationData = this.getReplicationData(entity, componentKey);
		if (replicationData === undefined || replicationData.connectedPlayers.isEmpty()) return;

		for (const player of replicationData.connectedPlayers) {
			const playerData = playerPayload.get(player) ?? new Map();
			playerPayload.set(player, playerData);

			const componentContainer = (playerData.get(tostring(entity)) ?? new Map()) as Map<
				ComponentKey<unknown>,
				{ data: unknown; payloadType: "init" | "patch" }
			>;
			playerData.set(tostring(entity), componentContainer);
			componentContainer.set(componentKey, {
				payloadType: "init",
				data: this.GetComponent(entity, componentKey),
			});
		}
	}

	private prepareChangedEntitySyncData(
		entity: Entity,
		componentKey: ComponentKey<unknown>,
		data: QueryRecord<unknown>,
		playerPayload: Map<Player, SyncData>,
	): void {
		const replicationData = this.getReplicationData(entity, componentKey);
		if (replicationData === undefined || replicationData.connectedPlayers.isEmpty()) return;

		const payload = patch.diff(data.old!, data.new!);
		for (const player of replicationData.connectedPlayers) {
			const playerData = playerPayload.get(player) ?? new Map();
			playerPayload.set(player, playerData);

			const componentContainer = (playerData.get(tostring(entity)) ?? new Map()) as Map<
				ComponentKey<unknown>,
				{ data: unknown; payloadType: "init" | "patch" }
			>;
			playerData.set(tostring(entity), componentContainer);
			componentContainer.set(componentKey, { payloadType: "patch", data: payload });
		}
	}

	private prepareRemovedEntitySyncData(
		entity: Entity,
		componentKey: ComponentKey<unknown>,
		playerPayload: Map<Player, SyncData>,
	): void {
		const replicationData = this.getReplicationData(entity, componentKey);
		if (replicationData === undefined) return;

		for (const player of replicationData.connectedPlayers) {
			const playerData = playerPayload.get(player) ?? new Map();

			playerPayload.set(player, playerData);
			const componentContainer = (playerData.get(tostring(entity)) ?? new Map()) as Map<
				ComponentKey<unknown>,
				{ data: unknown; payloadType: "init" | "patch" }
			>;
			playerData.set(tostring(entity), componentContainer);

			componentContainer.set(componentKey, {
				__removed: true,
			} as never);
		}
	}

	private prepareRemoveEntity(entity: Entity, playerPayload: Map<Player, SyncData>) {
		for (const player of Players.GetPlayers()) {
			const playerData = playerPayload.get(player) ?? new Map();
			playerPayload.set(player, playerData);
			playerData.set(tostring(entity), {
				__removed: true,
			} as never);
		}
	}

	private getReplicationData(entity: Entity, componentKey: ComponentKey<unknown>) {
		return this.GetComponent<ReplicationComponent>(entity)?.connectedPlayersByComponent.get(componentKey);
	}

	private setReplicationData(entity: Entity, componentKey: ComponentKey<unknown>, data: ReplicationData): void {
		this.SetComponent<ReplicationComponent>(
			entity,
			produce(this.GetComponent<ReplicationComponent>(entity)!, (draft) => {
				draft.connectedPlayersByComponent.set(componentKey, data);
			}),
		);
	}

	private getReplicationType(entity: Entity): ReplicationType {
		const instanceData = this.GetComponent<RobloxInstanceComponent>(entity);
		if (!instanceData) return ReplicationType.OnFirstPlayerConnection;

		return instanceData.Instance.IsA("BasePart")
			? ReplicationType.PerPlayerConnection
			: ReplicationType.OnFirstPlayerConnection;
	}

	private setupReplicationComponent(entity: Entity): void {
		this.SetComponent<ReplicationComponent>(entity, {
			replicationType: this.getReplicationType(entity),
		});
	}

	private sendSyncData(data: Map<Player, SyncData>): void {
		for (const [player, payload] of data) {
			this.OnSync.Fire(player, payload);
		}
	}

	private attachReplicationData(entity: Entity, componentKey: ComponentKey<unknown>): void {
		const allConnectedPlayers = this.getConnectedPlayers();
		const replicationComponent = this.GetComponent<ReplicationComponent>(entity);
		if (replicationComponent === undefined) return;

		const replicationOption = this.GetComponent<ReplicatedTag>(
			this.GetComponentId(componentKey as ComponentKey<unknown>) as Entity,
		) as unknown as ReplicateOption<unknown>;
		const connectedPlayers = replicationOption.resolvePlayerConnection
			? new Set<Player>()
			: table.clone(allConnectedPlayers);

		if (replicationOption.resolvePlayerConnection) {
			allConnectedPlayers.forEach((player) => {
				if (
					replicationOption.resolvePlayerConnection!(
						player,
						entity,
						this.GetComponent(entity, componentKey as ComponentKey<unknown>),
						this,
					)
				) {
					connectedPlayers.add(player);
				}
			});
		}

		replicationComponent.connectedPlayersByComponent.set(componentKey, {
			connectedPlayers: connectedPlayers,
		});
	}

	private clearReplicationData(entity: Entity, componentKey: ComponentKey<unknown>): void {
		const replicationComponent = this.GetComponent<ReplicationComponent>(entity);
		if (replicationComponent === undefined) return;

		this.SetComponent<ReplicationComponent>(
			entity,
			produce(replicationComponent, (draft) => {
				draft.connectedPlayersByComponent.delete(componentKey);
			}),
		);
	}

	private getConnectedPlayers(): Set<Player> {
		return this.GetComponent<ConnectedPlayersComponent>(this.connectedPlayersEntity)!.connectedPlayers;
	}

	private addConnectedPlayer(player: Player): void {
		this.SetComponent<ConnectedPlayersComponent>(
			this.connectedPlayersEntity,
			produce(this.GetComponent<ConnectedPlayersComponent>(this.connectedPlayersEntity)!, (draft) => {
				draft.connectedPlayers.add(player);
			}),
		);
	}

	private removeConnectedPlayer(player: Player): void {
		this.SetComponent<ConnectedPlayersComponent>(
			this.connectedPlayersEntity,
			produce(this.GetComponent<ConnectedPlayersComponent>(this.connectedPlayersEntity)!, (draft) => {
				draft.connectedPlayers.delete(player);
			}),
		);
	}

	public OnStartup(): void {
		this.connectedPlayersEntity = this.SpawnEntity<[ConnectedPlayersComponent]>([]);

		for (const component of this.Each<ReplicatedTag>()) {
			const networkComponent = this.GetComponentKey<string>(component)!;
			this.networkComponents.push(networkComponent);
		}
	}

	public OnEffect(): void {
		const playerPayloads = new Map<Player, SyncData>();
		for (const componentKey of this.networkComponents) {
			for (const [entity, record, isDestroyed] of this.QueryChange(componentKey as ComponentKey<object>)) {
				if (isDestroyed) {
					this.prepareRemoveEntity(entity, playerPayloads);
					continue;
				}

				// spawned component
				if (record.new !== undefined && record.old === undefined) {
					if (!this.HasComponent<ReplicationComponent>(entity)) {
						this.setupReplicationComponent(entity);
					}
					this.attachReplicationData(entity, componentKey as ComponentKey<unknown>);
					this.prepareAddedEntitySyncData(entity, componentKey as ComponentKey<object>, playerPayloads);
					continue;
				}

				// despawned component
				if (record.new === undefined && record.old !== undefined) {
					this.prepareRemovedEntitySyncData(entity, componentKey as ComponentKey<object>, playerPayloads);
					this.clearReplicationData(entity, componentKey as ComponentKey<object>);
					continue;
				}

				// changed component
				if (record.new !== undefined && record.old !== undefined) {
					this.prepareChangedEntitySyncData(
						entity,
						componentKey as ComponentKey<object>,
						record,
						playerPayloads,
					);
					continue;
				}
			}
		}

		for (const [entity, record] of this.QueryChange<RobloxInstanceComponent>()) {
			if (record.new !== undefined && record.old === undefined) {
				const replicationComponent = this.GetComponent<ReplicationComponent>(entity);
				if (replicationComponent === undefined) continue;
				this.SetComponent<ReplicationComponent>(
					entity,
					produce(replicationComponent, (draft) => {
						draft.replicationType = this.getReplicationType(entity);
					}),
				);
				continue;
			}

			if (record.new === undefined && record.old !== undefined) {
				const replicationComponent = this.GetComponent<ReplicationComponent>(entity);
				if (replicationComponent === undefined) continue;
				this.SetComponent<ReplicationComponent>(
					entity,
					produce(replicationComponent, (draft) => {
						draft.replicationType = ReplicationType.OnFirstPlayerConnection;
					}),
				);
			}
		}

		for (const [player] of useEvent(Players.PlayerRemoving)) {
			this.removeConnectedPlayer(player);

			for (const entity of this.Each<ReplicationComponent>()) {
				for (const component of this.networkComponents) {
					const data = this.GetComponent<ReplicationComponent>(entity);
					if (data === undefined) continue;

					this.SetComponent<ReplicationComponent>(
						entity,
						produce(data, (draft) => {
							draft.connectedPlayersByComponent.get(component)?.connectedPlayers.delete(player);
						}),
					);
				}
			}
		}

		if (!playerPayloads.isEmpty()) {
			this.sendSyncData(playerPayloads);
		}
	}
}
