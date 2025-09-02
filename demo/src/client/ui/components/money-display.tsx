import React from "@rbxts/react";
import { ValueDisplay } from "../views/value-display";
import { useLocalPlayerEntity } from "../hooks/use-local-player-entity";
import { useComponent } from "../hooks/use-component";
import { PlayerDataComponent } from "shared/components/player-data";

export function MoneyDisplay() {
	const entity = useLocalPlayerEntity();
	const component = useComponent<PlayerDataComponent>(entity)!;

	return <ValueDisplay value={component.Money} />;
}
