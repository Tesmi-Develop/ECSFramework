import { Tag } from "@rbxts/jecs";
import { CollectionService } from "@rbxts/services";
import { BaseSystem } from "../base-system";
import { RobloxInstanceComponent } from "../components/roblox-instance-component";
import { ECSSystem } from "../decorators/system";
import { TaggedInstance } from "../decorators/tagged";
import { DependenciesContainer } from "../dependencies-container";
import { ComponentKey } from "../flamecs/registry";
import { INSTANCE_ATTRIBUTE_ENTITY_ID } from "../utilities";
import { InjectType } from "../decorators/inject-type";

@ECSSystem({
	Priority: math.huge,
})
export class RobloxInstanceSystem extends BaseSystem {
	@InjectType
	private container!: DependenciesContainer;

	public GetEntityFromInstance(instance: Instance) {
		const id = instance.GetAttribute(INSTANCE_ATTRIBUTE_ENTITY_ID);
		return id as Tag | undefined;
	}

	public OnStartup() {
		this.Added<RobloxInstanceComponent>().connect((entity, data) => {
			if (data.Instance.GetAttribute(INSTANCE_ATTRIBUTE_ENTITY_ID) !== undefined) {
				throw "Instance already has an entity";
			}
			data.Instance.SetAttribute(INSTANCE_ATTRIBUTE_ENTITY_ID, entity);
		});

		this.Removed<RobloxInstanceComponent>().connect((entity) => {
			this.GetComponent<RobloxInstanceComponent>(entity)?.Instance.Destroy();
		});

		for (const component of this.Each<TaggedInstance<unknown>>()) {
			const options = this.GetComponent<TaggedInstance<unknown>>(component)!;
			const key = this.GetComponentKey(component);
			CollectionService.GetTagged(options.Tag).forEach((instance) => {
				const entity = this.GetEntityFromInstance(instance) ?? this.world.entity();

				this.SetComponent(entity, options.OnCreateData(instance, this.world, this.container), key as never);
				this.SetComponent<RobloxInstanceComponent>(entity, {
					Instance: instance,
				});

				instance.AncestryChanged.Once((_, parent) => {
					if (parent !== undefined) return;
					if (!this.ExistEntity(entity)) return;
					this.DespawnEntity(entity);
				});
			});

			CollectionService.GetInstanceAddedSignal(options.Tag).Connect((instance) => {
				const entity = this.GetEntityFromInstance(instance) ?? this.world.entity();
				this.SetComponent(entity, options.OnCreateData(instance, this.world, this.container), key as never);
				this.SetComponent<RobloxInstanceComponent>(entity, {
					Instance: instance,
				});

				instance.AncestryChanged.Once((_, parent) => {
					if (parent !== undefined) return;
					if (!this.ExistEntity(entity)) return;
					this.DespawnEntity(entity);
				});
			});

			CollectionService.GetInstanceRemovedSignal(options.Tag).Connect((instance) => {
				const entity = this.GetEntityFromInstance(instance);
				if (entity === undefined) return;
				this.RemoveComponent(entity, key as ComponentKey<{}>);
			});
		}
	}
}
