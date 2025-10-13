import { Flamework, Modding } from "@flamework/core";
import { registerTransformer } from "..";

interface Vector3Serialized {
	__type: "Vector3";
	X: number;
	Y: number;
	Z: number;
}

const guard = Flamework.createGuard<Vector3Serialized>();

export function Vector3TransformerSerialize(
	data: unknown,
	recursiveCallback: (data: unknown) => unknown,
	someData: {},
) {
	if (!typeIs(data, "Vector3")) return;

	return {
		__type: "Vector3",
		X: data.X,
		Y: data.Y,
		Z: data.Z,
	};
}

export function Vector3TransformerDeserialize(
	data: unknown,
	recursiveCallback: (data: unknown) => unknown,
	someData: {},
) {
	if (!guard(data)) return;
	return new Vector3(data.X, data.Y, data.Z);
}

registerTransformer(
	Vector3TransformerSerialize,
	Vector3TransformerDeserialize,
	(data) => typeIs(data, "Vector3"),
	(data) => guard(data),
);

/** @metadata macro */
function makeTransformer<TSer>(
	typeName: string,
	serialize: (data: any) => TSer,
	deserialize: (data: TSer) => unknown,
	guard?: Modding.Generic<TSer, "guard">,
) {
	function ser(data: unknown) {
		if (typeIs(data, typeName as never)) {
			return serialize(data);
		}

		return data;
	}
	function deser(data: unknown) {
		if (guard!(data)) {
			return deserialize(data);
		}

		return data;
	}
	registerTransformer(ser, deser, (data) => typeIs(data, typeName as never), guard!);
}

// BrickColor
interface BrickColorSerialized {
	__type: "BrickColor";
	r: number;
	g: number;
	b: number;
}
makeTransformer<BrickColorSerialized>(
	"BrickColor",
	(d: BrickColor) => ({ __type: "BrickColor", r: d.r, g: d.g, b: d.b }),
	(d) => new BrickColor(d.r, d.g, d.b),
);

// CFrame
interface CFrameSerialized {
	__type: "CFrame";
	comps: number[];
}
makeTransformer<CFrameSerialized>(
	"CFrame",
	(d: CFrame) => ({ __type: "CFrame", comps: d.GetComponents() }),
	(d) => new CFrame(d.comps[0], d.comps[1], d.comps[2], d.comps[3], d.comps[4], d.comps[5], d.comps[6]),
);

// Color3
interface Color3Serialized {
	__type: "Color3";
	r: number;
	g: number;
	b: number;
}
makeTransformer<Color3Serialized>(
	"Color3",
	(d: Color3) => ({ __type: "Color3", r: d.R, g: d.G, b: d.B }),
	(d) => new Color3(d.r, d.g, d.b),
);

// ColorSequence
interface ColorSequenceKeypointSerialized {
	time: number;
	value: { r: number; g: number; b: number };
}
interface ColorSequenceSerialized {
	__type: "ColorSequence";
	keypoints: ColorSequenceKeypointSerialized[];
}
makeTransformer<ColorSequenceSerialized>(
	"ColorSequence",
	(d: ColorSequence) => ({
		__type: "ColorSequence",
		keypoints: d.Keypoints.map((k) => ({ time: k.Time, value: { r: k.Value.R, g: k.Value.G, b: k.Value.B } })),
	}),
	(d) =>
		new ColorSequence(
			d.keypoints.map((k) => new ColorSequenceKeypoint(k.time, new Color3(k.value.r, k.value.g, k.value.b))),
		),
);

// DateTime
interface DateTimeSerialized {
	__type: "DateTime";
	unix: number;
}
makeTransformer<DateTimeSerialized>(
	"DateTime",
	(d: DateTime) => ({ __type: "DateTime", unix: d.UnixTimestamp }),
	(d) => DateTime.fromUnixTimestamp(d.unix),
);

// NumberRange
interface NumberRangeSerialized {
	__type: "NumberRange";
	min: number;
	max: number;
}
makeTransformer<NumberRangeSerialized>(
	"NumberRange",
	(d: NumberRange) => ({ __type: "NumberRange", min: d.Min, max: d.Max }),
	(d) => new NumberRange(d.min, d.max),
);

interface NumberSequenceKeypointSerialized {
	time: number;
	value: number;
	envelope: number;
}
interface NumberSequenceSerialized {
	__type: "NumberSequence";
	keypoints: NumberSequenceKeypointSerialized[];
}
makeTransformer<NumberSequenceSerialized>(
	"NumberSequence",
	(d: NumberSequence) => ({
		__type: "NumberSequence",
		keypoints: d.Keypoints.map((k) => ({ time: k.Time, value: k.Value, envelope: k.Envelope })),
	}),
	(d) => new NumberSequence(d.keypoints.map((k) => new NumberSequenceKeypoint(k.time, k.value, k.envelope))),
);

interface RectSerialized {
	__type: "Rect";
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}
makeTransformer<RectSerialized>(
	"Rect",
	(d: Rect) => ({
		__type: "Rect",
		minX: d.Min.X,
		minY: d.Min.Y,
		maxX: d.Max.X,
		maxY: d.Max.Y,
	}),
	(d) => new Rect(d.minX, d.minY, d.maxX, d.maxY),
);

interface Region3Serialized {
	__type: "Region3";
	min: [number, number, number];
	max: [number, number, number];
}
makeTransformer<Region3Serialized>(
	"Region3",
	(d: Region3) => {
		const [min, max] = d.CFrame
			? [d.CFrame.Position.sub(d.Size.div(2)), d.CFrame.Position.add(d.Size.div(2))]
			: [new Vector3(0, 0, 0), new Vector3(0, 0, 0)];
		return {
			__type: "Region3",
			min: [min.X, min.Y, min.Z],
			max: [max.X, max.Y, max.Z],
		};
	},
	(d) => new Region3(new Vector3(...d.min), new Vector3(...d.max)),
);

interface Region3int16Serialized {
	__type: "Region3int16";
	min: [number, number, number];
	max: [number, number, number];
}
makeTransformer<Region3int16Serialized>(
	"Region3int16",
	(d: Region3int16) => ({
		__type: "Region3int16",
		min: [d.Min.X, d.Min.Y, d.Min.Z],
		max: [d.Max.X, d.Max.Y, d.Max.Z],
	}),
	(d) => new Region3int16(new Vector3int16(...d.min), new Vector3int16(...d.max)),
);

interface TweenInfoSerialized {
	__type: "TweenInfo";
	time: number;
	easingStyle: Enum.EasingStyle;
	easingDirection: Enum.EasingDirection;
	repeatCount: number;
	reverses: boolean;
	delayTime: number;
}
makeTransformer<TweenInfoSerialized>(
	"TweenInfo",
	(d: TweenInfo) => ({
		__type: "TweenInfo",
		time: d.Time,
		easingStyle: d.EasingStyle,
		easingDirection: d.EasingDirection,
		repeatCount: d.RepeatCount,
		reverses: d.Reverses,
		delayTime: d.DelayTime,
	}),
	(d) => new TweenInfo(d.time, d.easingStyle, d.easingDirection, d.repeatCount, d.reverses, d.delayTime),
);

interface UDimSerialized {
	__type: "UDim";
	scale: number;
	offset: number;
}
makeTransformer<UDimSerialized>(
	"UDim",
	(d: UDim) => ({ __type: "UDim", scale: d.Scale, offset: d.Offset }),
	(d) => new UDim(d.scale, d.offset),
);

interface UDim2Serialized {
	__type: "UDim2";
	sx: number;
	ox: number;
	sy: number;
	oy: number;
}
makeTransformer<UDim2Serialized>(
	"UDim2",
	(d: UDim2) => ({
		__type: "UDim2",
		sx: d.X.Scale,
		ox: d.X.Offset,
		sy: d.Y.Scale,
		oy: d.Y.Offset,
	}),
	(d) => new UDim2(d.sx, d.ox, d.sy, d.oy),
);

interface Vector2Serialized {
	__type: "Vector2";
	x: number;
	y: number;
}
makeTransformer<Vector2Serialized>(
	"Vector2",
	(d: Vector2) => ({ __type: "Vector2", x: d.X, y: d.Y }),
	(d) => new Vector2(d.x, d.y),
);

interface Vector2int16Serialized {
	__type: "Vector2int16";
	x: number;
	y: number;
}
makeTransformer<Vector2int16Serialized>(
	"Vector2int16",
	(d: Vector2int16) => ({ __type: "Vector2int16", x: d.X, y: d.Y }),
	(d) => new Vector2int16(d.x, d.y),
);

interface Vector3int16Serialized {
	__type: "Vector3int16";
	x: number;
	y: number;
	z: number;
}
makeTransformer<Vector3int16Serialized>(
	"Vector3int16",
	(d: Vector3int16) => ({ __type: "Vector3int16", x: d.X, y: d.Y, z: d.Z }),
	(d) => new Vector3int16(d.x, d.y, d.z),
);
