import { DataField, IInheritingPrototype, InheritanceBehavior, IPrototype, Prototype } from "@rbxts/prototype";

function InheritanceBehaviorComponents(
	current: Map<string, Record<string, unknown>>,
	parent: Map<string, Record<string, unknown>>,
) {
	const newComponents = table.clone(current);
	for (const [key, value] of parent) {
		if (newComponents.has(key)) continue;
		newComponents.set(key, value);
	}

	return newComponents;
}

@Prototype()
export class EntityPrototype implements IPrototype, IInheritingPrototype {
	public Id!: string;
	public Parents!: string[];

	@DataField()
	@InheritanceBehavior(InheritanceBehaviorComponents)
	public Components!: Map<string, Record<string, unknown>>;
}
