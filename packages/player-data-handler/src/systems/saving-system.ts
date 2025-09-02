import { BaseSystem, ECSSystem, InjectType } from "@ecsframework/core";
import { ProfileWrapper } from "../profile-wrapper";
import { Constructor } from "@flamework/core/out/utility";
import { Entity } from "@rbxts/jecs";
import { DependenciesContainer } from "@ecsframework/core";

@ECSSystem()
export class SavingSystem extends BaseSystem {
	@InjectType
	private container!: DependenciesContainer;
	private loadedProfile: Map<Player, ProfileWrapper> = new Map();
	private wrapper?: Constructor<ProfileWrapper>;

	public SetProfileWrapper(wrapper: Constructor<ProfileWrapper>) {
		this.wrapper = wrapper;
	}

	public GetProfile(player: Player) {
		return this.loadedProfile.get(player);
	}

	public async LoadProfile(player: Player, entity: Entity) {
		if (!this.wrapper) {
			throw "No profile wrapper set";
		}

		const profile = new this.wrapper(
			player as never,
			entity as never,
			this as never,
			this.world as never,
			this.container as never,
			(() => {
				this.loadedProfile.delete(player);
			}) as never,
		);
		this.loadedProfile.set(player, profile);
		await profile.LoadProfile();
		return profile;
	}

	public SaveProfile(player: Player) {
		const profile = this.loadedProfile.get(player);
		if (!profile) {
			throw "No profile found";
		}

		profile.SaveProfile();
	}

	public CloseProfile(player: Player) {
		const profile = this.loadedProfile.get(player);
		if (!profile) {
			throw "No profile found";
		}

		profile.CloseProfile();
		this.loadedProfile.delete(player);
	}
}
