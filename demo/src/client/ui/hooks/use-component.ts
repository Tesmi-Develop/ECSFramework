import { ComponentKey, Entity, ResolveKey } from "@ecsframework/core";
import { useSystem } from "./use-system";
import { useEffect, useState } from "@rbxts/react";

/** @metadata macro */
export function useComponent<T>(entity: Entity, componentKey?: ComponentKey<T>) {
	const system = useSystem();
	const [value, setValue] = useState<T | undefined>(
		system.GetComponent<T>(entity, componentKey as ResolveKey<T>) as T,
	);

	useEffect(() => {
		const unsubscribeAdd = system.Added<T>(componentKey as ComponentKey<T>).connect((newEntity, data) => {
			if (newEntity !== entity) return;
			setValue(data);
		});

		const unsubscribeChange = system.Changed<T>(componentKey as ComponentKey<T>).connect((newEntity, data) => {
			if (newEntity !== entity) return;
			setValue(data);
		});

		const unsubscribeRemove = system.Removed<T>(componentKey as ComponentKey<T>).connect((removedEntity) => {
			if (removedEntity !== entity) return;
			setValue(undefined);
		});

		return () => {
			unsubscribeAdd();
			unsubscribeChange();
			unsubscribeRemove();
		};
	}, [entity, componentKey, system]);

	return value;
}
