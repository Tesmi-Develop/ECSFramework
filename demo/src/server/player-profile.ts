import { Flamework } from "@ecsframework/core";
import { ComponentData, ProfileWrapper } from "@ecsframework/player-data-handler";
import { createCollection, Document } from "@rbxts/lapis";

interface PlayerData {
	Components: Map<string, ComponentData>;
}

const collection = createCollection<PlayerData>("PlayerProfiles", {
	defaultData: {
		Components: new Map<string, ComponentData>(),
	},
	validate: Flamework.createGuard<PlayerData>(),
});

function DeepCloneTable<T>(data: T) {
	if (!typeIs(data, "table")) return data as T;

	const newTable = {};
	for (const [key, value] of pairs(data)) {
		newTable[key as never] = DeepCloneTable(value) as never;
	}

	return newTable as T;
}

export class PlayerProfile extends ProfileWrapper {
	protected isSaveDataWhenClose = false;
	private document!: Document<PlayerData>;

	protected async onLoadProfile(): Promise<Map<string, ComponentData>> {
		return (
			await collection
				.load(tostring(this.player.UserId), [this.player.UserId])
				.then((document) => {
					if (this.player.Parent === undefined) {
						document.close().catch(warn);
						throw "Player disconnected";
					}

					this.document = document;
					return DeepCloneTable(document.read());
				})
				.catch((message) => {
					warn(`Player {player.Name}'s data failed to load: {message}`);

					this.player.Kick("Data failed to load.");

					throw message;
				})
		).Components;
	}

	protected onChangedData(data: Map<string, ComponentData>): void {
		this.document.write({
			Components: data,
		});
	}

	protected onSaveProfile(data: Map<string, ComponentData>): Promise<void> {
		if (this.document === undefined) {
			return Promise.resolve();
		}

		return this.document.save();
	}

	protected onCloseProfile(): Promise<void> {
		if (this.document === undefined) {
			return Promise.resolve();
		}
		return this.document.close();
	}
}
