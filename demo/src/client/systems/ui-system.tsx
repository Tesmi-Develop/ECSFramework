import { BaseSystem, ECSSystem, Entity, RobloxInstanceComponent } from "@ecsframework/core";
import { createPortal, createRoot } from "@rbxts/react-roblox";
import { Players } from "@rbxts/services";
import { ReadyPlayerTag } from "shared/components/on-ready-player";
import React from "@rbxts/react";
import { App } from "client/ui/app";
import { Canvas } from "client/ui/canvas";
import { SystemProvider } from "client/ui/system-provider";

const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;

@ECSSystem({
	Priority: -math.huge,
})
export class UISystem extends BaseSystem {
	private root = createRoot(new Instance("Folder"));

	private isLocalPlayerEntity(entity: Entity): boolean {
		const instanceData = this.GetComponent<RobloxInstanceComponent>(entity);
		return instanceData !== undefined && instanceData.Instance === Players.LocalPlayer;
	}

	OnEffect(): void {
		for (const [entity] of this.QueryChange<ReadyPlayerTag>()) {
			if (this.isLocalPlayerEntity(entity)) {
				this.root.render(
					createPortal(
						<SystemProvider.Provider value={{ system: this }}>
							<Canvas>
								<App></App>
							</Canvas>
						</SystemProvider.Provider>,
						playerGui,
					),
				);
				return;
			}
		}
	}
}
