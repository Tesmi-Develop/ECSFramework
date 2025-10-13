import { BaseSystem, ECSSystem, InjectType } from "@ecsframework/core";
import { EntityPrototype, EntityPrototypeSystem } from "@ecsframework/entity-prototype";
import { IPrototype } from "@rbxts/prototype";
import { TestComponent } from "shared/components/test-component";

@ECSSystem()
export class PrototypeLoader extends BaseSystem {
	@InjectType
	private prototypeSystem!: EntityPrototypeSystem;

	OnStartup(): void {
		const handler = this.prototypeSystem.GetHandler();
		handler.RegisterPrototype(
			{
				Id: "TestProto",
				Components: {
					["TestComponent"]: {
						Value: 5,
					},
				},
			} as IPrototype,
			`${EntityPrototype}`,
		);
		handler.RegisterPrototype(
			{
				Id: "TestProto1",
				Parents: ["TestProto"],
				Components: {
					["TestComponent"]: {
						Value: 10,
					},
				},
			} as IPrototype,
			`${EntityPrototype}`,
		);
		handler.Compile();

		task.delay(5, () => {
			const entity = this.prototypeSystem.Instantiate("TestProto1");
			print("Instantiated", entity, this.GetComponent<TestComponent>(entity));
		});
	}
}
