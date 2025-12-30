import { BaseSystem, ComponentKey } from "@ecsframework/core";
import { VoidCallback } from "@ecsframework/core/out/framework/utilities";
import { Entity, World } from "@rbxts/jecs";
import { t } from "@rbxts/t";
import { produce } from "@rbxts/immut";
import { Constructor } from "@flamework/core/out/utility";
import { DependenciesContainer } from "@ecsframework/core/out/framework/dependencies-container";
import { SavedData } from "./types";
import { Deserialize, Serialize } from "./serilizator";

export interface ComponentInfo {
	Guard: t.check<unknown>;
	Ctor: Constructor<unknown>;
	OnCreateData?: (world: World, container: DependenciesContainer, system: BaseSystem) => object;
	Migrations: ((data: unknown) => unknown)[];
}

export interface ComponentData {
	Data: unknown;
	Version: number;
}

export abstract class ProfileWrapper {
	protected abstract readonly isSaveDataWhenClose: boolean;
	private data: Map<string, ComponentData> = new Map();
	private savedComponents: Map<string, ComponentInfo> = new Map();
	private isLoaded = false;
	private isClosed = false;
	private connections: VoidCallback[] = [];

	constructor(
		protected readonly player: Player,
		protected readonly entity: Entity,
		protected readonly system: BaseSystem,
		protected readonly world: World,
		protected readonly container: DependenciesContainer,
		private onClose: VoidCallback,
	) {
		for (const componentId of system.Each<SavedData>()) {
			const savedComponent = system.GetComponentKey<string>(componentId)!;
			const ctor = system.GetClassComponent(savedComponent as ComponentKey<unknown>);
			const options = system.GetComponent<SavedData>(componentId)!;

			if (options.Guard === undefined) {
				throw `No guard found for ${savedComponent}`;
			}

			this.savedComponents.set(`${ctor}`, {
				Guard: options.Guard,
				OnCreateData: options.OnCreate,
				Ctor: ctor,
				Migrations: options.Migrations ?? [],
			});
		}
	}

	public GetIsClosed() {
		return this.isClosed;
	}

	protected abstract onLoadProfile(): Promise<Map<string, ComponentData>>;
	protected abstract onSaveProfile(data: Map<string, ComponentData>): Promise<void>;
	protected abstract onCloseProfile(): Promise<void>;
	protected abstract onChangedData(data: Map<string, ComponentData>): void;

	private changeData(data: Map<string, ComponentData>) {
		this.data = data;
		this.onChangedData(data);
	}

	private createComponentData(componentName: string): unknown {
		const info = this.savedComponents.get(componentName);
		if (info === undefined) {
			throw `No info found for ${componentName}`;
		}
		const ctor = info.Ctor as never as { constructor: (data: unknown) => unknown };
		const addtitionalData = info.OnCreateData?.(this.world, this.container, this.system);

		const finalData = {};
		ctor.constructor(finalData);
		if (addtitionalData !== undefined) {
			for (const [key, _] of pairs(addtitionalData)) {
				finalData[key as never] = addtitionalData[key as never] as never;
			}
		}

		return finalData;
	}

	private subscribeToComponents() {
		for (const [componentName, componentInfo] of this.savedComponents) {
			let componentData = this.data.get(componentName);

			if (componentData === undefined) {
				const data = this.createComponentData(componentName);
				if (!componentInfo.Guard(data)) {
					throw `Data for ${componentName} is invalid`;
				}
				componentData = { Data: data, Version: componentInfo.Migrations.size() };

				this.changeData(
					produce(this.data, (draft) => {
						draft.set(componentName, componentData!);
					}),
				);
			}

			const key = this.system.GetComponentKeyByName(componentName);
			if (!key) {
				warn(`No component key found for ${componentName}`);
				continue;
			}

			this.system.SetComponent(this.entity, componentData.Data, key as ComponentKey<unknown>);

			const guard = componentInfo.Guard;
			this.connections.push(
				this.system.Added(key as ComponentKey<unknown>).connect((entity, data) => {
					if (entity !== this.entity) return;
					if (guard !== undefined && !guard(data)) {
						warn(`Trying to save invalid data for ${componentName}`, data);
						return;
					}

					this.changeData(
						produce(this.data, (draft) => {
							draft.get(componentName)!.Data = data;
						}),
					);
				}),
			);

			this.connections.push(
				this.system.Changed(key as ComponentKey<unknown>).connect((entity, data) => {
					if (entity !== this.entity) return;
					if (guard !== undefined && !guard(data)) {
						warn(`Trying to save invalid data for ${componentName}`, data);
						return;
					}

					this.changeData(
						produce(this.data, (draft) => {
							draft.get(componentName)!.Data = data;
						}),
					);
				}),
			);
		}
	}

	public async LoadProfile() {
		if (this.isLoaded) {
			return this.data;
		}

		this.isLoaded = true;
		let playerData = await this.onLoadProfile();
		let newPlayerData = playerData;

		for (const [componentName, componentData] of playerData) {
			if (!typeIs(componentData, "table")) {
				throw `Data for ${componentName} is not a table`;
			}

			if (componentData.Version === undefined) {
				this.changeData(
					produce(playerData, (draft) => {
						draft.get(componentName)!.Version = 0;
					}),
				);
			}

			if (componentData.Data === undefined) {
				this.changeData(
					produce(playerData, (draft) => {
						draft.get(componentName)!.Data = {};
					}),
				);
			}

			const componentInfo = this.savedComponents.get(componentName);
			if (componentInfo === undefined) continue;

			let currentComponentData = Deserialize(componentData.Data, {
				System: this.system,
				World: this.world,
			});
			let currentVersion = componentData.Version;

			if (componentInfo.Migrations.size() > componentData.Version) {
				for (let i = componentData.Version; i < componentInfo.Migrations.size(); i++) {
					currentComponentData = componentInfo.Migrations[i](currentComponentData);
					currentVersion++;
				}
			}

			if (!componentInfo.Guard(currentComponentData)) {
				throw `Guard failed for ${componentName}`;
			}

			newPlayerData = produce(newPlayerData, (draft) => {
				draft.get(componentName)!.Data = currentComponentData;
				draft.get(componentName)!.Version = currentVersion;
			});

			this.changeData(newPlayerData);
		}

		this.subscribeToComponents();
		return newPlayerData;
	}

	private serializeComponentData(data: Map<string, ComponentData>): Map<string, ComponentData> {
		const serializedData: Map<string, ComponentData> = table.clone(data);

		for (const [componentName, componentData] of serializedData) {
			serializedData.set(componentName, {
				Data: Serialize(componentData.Data, {
					System: this.system,
					World: this.world,
				}),
				Version: componentData.Version,
			});
		}

		return serializedData;
	}

	public async SaveProfile() {
		return this.onSaveProfile(this.serializeComponentData(await this.LoadProfile()));
	}

	public async CloseProfile() {
		if (this.isClosed) {
			return;
		}

		this.isClosed = true;
		if (this.isSaveDataWhenClose) await this.onSaveProfile(this.serializeComponentData(this.data));
		await this.onCloseProfile();
		this.connections.forEach((disconnect) => disconnect());

		this.onClose();
	}
}
