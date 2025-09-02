import React from "@rbxts/react";

interface Props {
	value: number;
}

export function ValueDisplay(props: Props) {
	return (
		<textlabel
			Position={UDim2.fromScale(0.5, 0)}
			AnchorPoint={new Vector2(0.5, 0)}
			Size={UDim2.fromScale(0.3, 0.15)}
			Text={`Value: ${props.value}`}
		></textlabel>
	);
}
