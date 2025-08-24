import { ECSComponent, Tagged } from "@ecsframework/core";

@Tagged({
	Tag: "Click",
	OnCreateData: (instance) => ({
		Amount: instance.GetAttribute("Amount") ?? 0,
	}),
})
@ECSComponent()
export class ClickPartComponent {
	public Amount = 0;
}
