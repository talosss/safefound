<template>
  <div class="ui-dropdown" :class="classes" v-on="$listeners">
    <div
      ref="trigger"
      class="ui-dropdown__trigger"
      :class="triggerClass"
      v-on="trigger_listeners"
    >
      <slot v-bind="{ shown: local_shown }" />
    </div>

    <client-only>
      <component
        :is="mountSelf ? fade_transition : 'mounting-portal'"
        :transition="fade_transition"
        :mount-to="mountTo"
        append
      >
        <div
          v-if="local_shown && !disabled"
          ref="portal"
          class="ui-dropdown-portal"
          :class="portal_classes"
          :style="portal_styles"
          v-on="portal_listeners"
        >
          <div class="ui-dropdown-portal__layout">
            <slot name="portal" v-bind="{ hide }" />

            <div v-if="arrow" class="ui-dropdown-portal__arrow" />
          </div>
        </div>
      </component>
    </client-only>
  </div>
</template>

<script>
import { MountingPortal } from 'portal-vue';
import { ResizeObserver } from '@juggle/resize-observer';
import ClientOnly from 'vue-client-only';

const positions = ['top', 'right', 'bottom', 'left'];
const alignments = ['start', 'center', 'end', 'stretch'];

const placements = positions.reduce((acc, current) => [...acc, ...alignments.map((align) => `${current}-${align}`)], []);

export default {
  components: {
    MountingPortal,
    ClientOnly,
  },
  inheritAttrs: false,
  props: {
    shown: {
      type: Boolean,
      default: false,
    },
    arrow: {
      type: Boolean,
      default: true,
    },
    placement: {
      type: String,
      default: 'bottom-center',
      validator(value) {
        const [placement, fallback] = value.split('|');

        return fallback
          ? placements.includes(placement) && placements.includes(fallback)
          : placements.includes(placement);
      },
    },
    trigger: {
      type: String,
      default: 'click',
      validator(value) {
        return ['hover', 'click', ''].includes(value);
      },
    },
    relativeEl: {
      type: [String, global.Element],
      default: '',
    },
    viewportEl: {
      type: [String, global.Element],
      default: '',
    },
    documentTargets: {
      type: Array,
      default: () => ['portal', 'trigger'],
    },
    offset: {
      type: Array,
      default: () => [0, 0, 0, 0],
    },
    viewportOffset: {
      type: Array,
      default: () => [0, 0, 0, 0],
    },
    portalClass: {
      type: [Array, String, Object],
      default: '',
    },
    triggerClass: {
      type: [Array, String, Object],
      default: '',
    },
    autoHide: {
      type: Boolean,
      default: true,
    },
    hoverPortal: {
      type: Boolean,
      default: false,
    },
    clickPortal: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    noPadding: {
      type: Boolean,
      default: false,
    },
    zIndex: {
      type: [Number, String],
      default: 50,
    },
    transition: {
      type: String,
      default: 'fade',
    },
    transitionMode: {
      type: String,
      default: 'in-out',
    },
    mountTo: {
      type: String,
      default: 'body',
    },
    mountSelf: {
      type: Boolean,
      default: false,
    },
    autoAlignment: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      local_shown: this.shown,
      trigger_hover_timer: null,
      portal_hover_timer: null,
      resize_observers: {
        portal: null,
        trigger: null,
        viewport: null,
      },
      coords: {
        document: {
          width: 0,
          height: 0,
          scrollTop: 0,
          scrollRight: 0,
          scrollBottom: 0,
          scrollLeft: 0,
        },
        portal: {
          width: 0,
          height: 0,
        },
        trigger: {
          width: 0,
          height: 0,
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        },
        viewport: {
          height: 0,
          width: 0,
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        },
      },
    };
  },
  computed: {
    fade_transition() {
      return {
        functional: true,
        render: (h, { children }) => {
          const props = {
            name: this.transition,
            mode: this.transitionMode,
          };

          const on = {
            enter: this.onShow,
            leave: this.onHide,
          };

          return h('transition', { props, on }, children);
        },
      };
    },
    position() {
      const [placement] = this.placement.split('|');

      return placement.split('-')[0];
    },
    fallback_position() {
      const [placement, fallback] = this.placement.split('|');

      return (fallback || placement).split('-')[0];
    },
    alignment() {
      const [placement] = this.placement.split('|');

      return placement.split('-')[1];
    },
    fallback_alignment() {
      const [placement, fallback] = this.placement.split('|');

      return (fallback || placement).split('-')[1];
    },
    offsets() {
      return [this.offset[0], this.offset[1]];
    },
    fallback_offsets() {
      return [this.offset[2] || 0, this.offset[3] || 0];
    },
    portal_coords() {
      return this.calculatePortalCoords(this.position, this.alignment, this.offsets);
    },
    portal_in_viewport() {
      return this.checkInViewport(this.portal_coords[this.position], this.position, this.mountSelf);
    },
    computed_position() {
      return this.portal_in_viewport ? this.position : this.fallback_position;
    },
    computed_alignment() {
      if (this.autoAlignment) {
        return this.getAutoAlignment(
          this.portal_coords,
          this.computed_position,
          this.portal_in_viewport ? this.alignment : this.fallback_alignment,
          this.mountSelf,
        );
      }

      return this.portal_in_viewport ? this.alignment : this.fallback_alignment;
    },
    computed_offsets() {
      return this.portal_in_viewport ? this.offsets : this.fallback_offsets;
    },
    portal_styles() {
      const coords = this.calculatePortalCoords(
        this.computed_position,
        this.computed_alignment,
        this.computed_offsets,
        this.mountSelf,
      );

      return {
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: coords.width ? `${coords.width}px` : undefined,
        height: coords.height ? `${coords.height}px` : undefined,
        zIndex: this.zIndex,
      };
    },
    portal_classes() {
      return [
        this.portalClass,
        `ui-dropdown-portal--${this.computed_position}`,
        `ui-dropdown-portal--${this.computed_alignment}`,
        {
          'ui-dropdown-portal--arrow': this.arrow,
          'ui-dropdown-portal--no-padding': this.noPadding,
        },
      ];
    },
    classes() {
      return {
        'ui-dropdown--shown': this.local_shown,
        'ui-dropdown--disabled': this.disabled,
        'ui-dropdown--self': this.mountSelf,
      };
    },
    trigger_listeners_hover() {
      return {
        mouseenter: this.onTriggerMouseenter,
        mouseleave: this.onTriggerMouseleave,
      };
    },
    trigger_listeners_click() {
      return {
        click: this.toggle,
      };
    },
    trigger_listeners() {
      return this[`trigger_listeners_${this.trigger}`];
    },
    portal_listeners_hover() {
      return {
        mouseenter: this.onPortalMouseenter,
        mouseleave: this.onPortalMouseleave,
      };
    },
    portal_listeners_click() {
      return {
        click: this.onPortalClick,
      };
    },
    portal_listeners() {
      return this[`portal_listeners_${this.trigger}`];
    },
  },
  watch: {
    local_shown(value) {
      this.$emit('update:shown', value);
    },
    shown(value) {
      this.local_shown = value;
    },
  },
  methods: {
    getPositionAxis(position) {
      const axises = {
        top: 'y',
        bottom: 'y',
        left: 'x',
        right: 'x',
      };

      return axises[position];
    },
    getPortalPositionCoords(position) {
      const { trigger, portal } = this.coords;
      const { scrollTop, scrollLeft } = this.coords.document;

      switch (position) {
        case 'top':
          return {
            top: trigger.top - portal.height + scrollTop,
            left: trigger.left + scrollLeft,
          };

        case 'right':
          return {
            top: trigger.top + scrollTop,
            left: trigger.right + scrollLeft,
          };

        case 'bottom':
          return {
            top: trigger.bottom + scrollTop,
            left: trigger.left + scrollLeft,
          };

        case 'left':
          return {
            top: trigger.top + scrollTop,
            left: trigger.left - portal.width + scrollLeft,
          };

        default:
          throw new Error('position required');
      }
    },
    getPortalSelfPositionCoords(position) {
      switch (position) {
        case 'top':
          return {
            top: -this.coords.portal.height,
            left: 0,
          };

        case 'right':
          return {
            top: 0,
            left: this.coords.trigger.width,
          };

        case 'bottom':
          return {
            top: this.coords.trigger.height,
            left: 0,
          };

        case 'left':
          return {
            top: 0,
            left: -this.coords.portal.width,
          };

        default:
          throw new Error('position required');
      }
    },
    getPortalAlignmentCoords(position, alignment) {
      const { trigger, portal } = this.coords;

      const axis = this.getPositionAxis(position);

      if (axis === 'x') {
        switch (alignment) {
          case 'start':
            return { left: 0, top: 0 };

          case 'center':
            return {
              left: 0,
              top: trigger.height / 2 - portal.height / 2,
            };

          case 'end':
            return {
              left: 0,
              top: trigger.height - portal.height,
            };

          case 'stretch':
            return {
              left: 0,
              top: 0,
              height: this.coords.trigger.height,
            };

          default:
            throw new Error('alignment required');
        }
      } else if (axis === 'y') {
        switch (alignment) {
          case 'start':
            return { left: 0, top: 0 };

          case 'center':
            return {
              left: trigger.width / 2 - portal.width / 2,
              top: 0,
            };

          case 'end':
            return {
              left: trigger.width - portal.width,
              top: 0,
            };

          case 'stretch':
            return {
              left: 0,
              top: 0,
              width: this.coords.trigger.width,
            };

          default:
            throw new Error('alignment required');
        }
      } else {
        throw new Error('axis required');
      }
    },
    getPortalOffsetCoords(position, offsets) {
      switch (position) {
        case 'top':
          return {
            left: offsets[0],
            top: -offsets[1],
          };

        case 'right':
          return {
            left: offsets[0],
            top: offsets[1],
          };

        case 'bottom':
          return {
            left: offsets[0],
            top: offsets[1],
          };

        case 'left':
          return {
            left: -offsets[0],
            top: offsets[1],
          };

        default:
          throw new Error('position required');
      }
    },
    calculatePortalCoords(position, alignment, offsets, self) {
      const positionCoords = self
        ? this.getPortalSelfPositionCoords(position)
        : this.getPortalPositionCoords(position);

      const alignmentCoords = this.getPortalAlignmentCoords(position, alignment);
      const offsetCoords = this.getPortalOffsetCoords(position, offsets);
      const top = positionCoords.top + alignmentCoords.top + offsetCoords.top;
      const left = positionCoords.left + alignmentCoords.left + offsetCoords.left;

      return {
        top,
        right: left + this.coords.portal.width,
        bottom: top + this.coords.portal.height,
        left,
        width: alignmentCoords.width || undefined,
        height: alignmentCoords.height || undefined,
      };
    },
    checkInViewport(coords, position, self) {
      const { document, viewport } = this.coords;
      const [offsetTop, offsetRight, offsetBottom, offsetLeft] = this.viewportOffset;
      const {
        scrollTop, scrollRight, scrollBottom, scrollLeft,
      } = document;

      if (self) {
        switch (position) {
          case 'top':
            return coords >= scrollTop + viewport.top + offsetTop;

          case 'right':
            return coords <= scrollRight - (document.width - viewport.right) - offsetRight;

          case 'bottom':
            return coords <= scrollBottom - (document.height - viewport.bottom) - offsetBottom;

          case 'left':
            return coords >= scrollLeft + viewport.left + offsetLeft;

          default:
            throw new Error('position required');
        }
      } else {
        switch (position) {
          case 'top':
            return coords >= scrollTop + offsetTop;

          case 'right':
            return coords <= scrollRight - offsetRight;

          case 'bottom':
            return coords <= scrollBottom - offsetBottom;

          case 'left':
            return coords >= scrollLeft + offsetLeft;

          default:
            throw new Error('position required');
        }
      }
    },
    getAutoAlignment(rect, position, alignment, self) {
      const { trigger } = this.coords;
      const { scrollTop, scrollLeft } = this.coords.document;
      const axis = this.getPositionAxis(position);

      if (axis === 'x') {
        if (scrollTop + trigger.top > rect.top && !this.checkInViewport(rect.top, 'top', self)) {
          return 'start';
        }

        if (scrollTop + trigger.bottom < rect.bottom && !this.checkInViewport(rect.bottom, 'bottom', self)) {
          return 'end';
        }
      }

      if (axis === 'y') {
        if (scrollLeft + trigger.left > rect.left && !this.checkInViewport(rect.left, 'left', self)) {
          return 'start';
        }

        if (scrollLeft + trigger.right < rect.right && !this.checkInViewport(rect.right, 'right', self)) {
          return 'end';
        }
      }

      return alignment;
    },
    getViewportEl() {
      return typeof this.viewportEl === 'string' && this.viewportEl
        ? this.$el.closest(this.viewportEl)
        : this.viewportEl;
    },
    getRelativeEl() {
      return typeof this.relativeEl === 'string' && this.relativeEl
        ? this.$el.querySelector(this.relativeEl)
        : this.relativeEl;
    },
    toggle() {
      if (!this.disabled) {
        this.local_shown = !this.local_shown;
      }
    },
    show() {
      if (!this.disabled) {
        this.local_shown = true;
      }
    },
    hide() {
      if (!this.disabled) {
        this.local_shown = false;
      }
    },
    onTriggerMouseenter() {
      if (this.portal_hover_timer) {
        clearInterval(this.portal_hover_timer);
      } else {
        this.show();
      }
    },
    onTriggerMouseleave() {
      if (this.hoverPortal) {
        this.trigger_hover_timer = setTimeout(() => {
          this.portal_hover_timer = null;

          this.hide();
        }, 100);
      } else {
        this.hide();
      }
    },
    onPortalMouseenter() {
      clearInterval(this.trigger_hover_timer);
    },
    onPortalMouseleave() {
      this.portal_hover_timer = setTimeout(() => {
        this.portal_hover_timer = null;

        this.hide();
      }, 100);
    },
    onPortalClick() {
      if (this.clickPortal) {
        this.hide();
      }
    },
    onDocumentClick(event) {
      const selectors = {
        trigger: '.ui-dropdown__trigger',
        portal: '.ui-dropdown-portal',
      };

      const elements = this.documentTargets.map((key) => this.$refs[key]);

      const targets = this.documentTargets.map((key) => event.target.closest(selectors[key]));

      if (!targets.some((target) => elements.includes(target))) {
        this.hide();
      }
    },
    onDocumentChangeCoords() {
      const { clientWidth, clientHeight } = document.documentElement;
      const { pageYOffset, pageXOffset } = window;

      this.coords.document = {
        width: clientWidth,
        height: clientHeight,
        scrollTop: pageYOffset,
        scrollRight: pageXOffset + clientWidth,
        scrollLeft: pageXOffset,
        scrollBottom: pageYOffset + clientHeight,
      };
    },
    onPortalChangeCoords() {
      if (this.$refs.portal) {
        const { portal } = this.$refs;
        const { width, height } = portal.getBoundingClientRect();

        this.coords.portal = { width, height };
      }
    },
    onTriggerChangeCoords() {
      const relativeEl = this.getRelativeEl() || this.$refs.trigger;

      if (relativeEl) {
        const {
          top, right, bottom, left, width, height,
        } = relativeEl.getBoundingClientRect();

        this.coords.trigger = {
          width,
          height,
          top,
          right,
          bottom,
          left,
        };
      }
    },
    onViewportElChangeCoords() {
      const viewportParent = this.getViewportEl();
      const {
        top, right, bottom, left, width, height,
      } = viewportParent.getBoundingClientRect();

      this.coords.viewport = {
        width,
        height,
        top,
        right,
        bottom,
        left,
      };
    },
    observeDocumentClick() {
      if (this.autoHide) {
        document.addEventListener('click', this.onDocumentClick, true);
      }
    },
    unobserveDocumentClick() {
      if (this.autoHide) {
        document.removeEventListener('click', this.onDocumentClick, true);
      }
    },
    observeDocumentCoords() {
      const viewportParent = this.getViewportEl();

      window.addEventListener('resize', this.onDocumentChangeCoords);
      window.addEventListener('scroll', this.onDocumentChangeCoords);

      window.addEventListener('scroll', this.onTriggerChangeCoords, true);
      window.addEventListener('scroll', this.onPortalChangeCoords, true);

      if (this.viewportEl && viewportParent) {
        window.addEventListener('scroll', this.onViewportElChangeCoords, true);
      }

      this.onDocumentChangeCoords();
    },
    unobserveDocumentCoords() {
      window.removeEventListener('resize', this.onDocumentChangeCoords);
      window.removeEventListener('scroll', this.onDocumentChangeCoords);

      window.removeEventListener('scroll', this.onTriggerChangeCoords, true);
      window.removeEventListener('scroll', this.onPortalChangeCoords, true);

      if (this.viewportEl) {
        window.removeEventListener('scroll', this.onViewportElChangeCoords, true);
      }
    },
    observePortalCoords() {
      this.resize_observers.portal = new ResizeObserver(
        this.onPortalChangeCoords,
      );

      this.resize_observers.portal.observe(this.$refs.portal);
      this.resize_observers.portal.observe(document.documentElement);
    },
    unobservePortalCoords() {
      this.resize_observers.portal.disconnect();
    },
    observeTriggerCoords() {
      this.resize_observers.trigger = new ResizeObserver(
        this.onTriggerChangeCoords,
      );

      this.resize_observers.trigger.observe(this.$refs.trigger);
      this.resize_observers.trigger.observe(document.documentElement);
    },
    unobserveTriggerCoords() {
      this.resize_observers.trigger.disconnect();
    },
    observeViewportElCoords() {
      const viewportParent = this.getViewportEl();

      if (this.viewportEl && viewportParent) {
        this.resize_observers.viewport = new ResizeObserver(
          this.onViewportElChangeCoords,
        );

        this.resize_observers.viewport.observe(viewportParent);
      }
    },
    unobserveViewportElCoords() {
      const viewportParent = this.getViewportEl();

      if (this.viewportEl && viewportParent) {
        this.resize_observers.viewport.disconnect();
      }
    },
    onShow() {
      this.observeDocumentClick();
      this.observeDocumentCoords();
      this.observePortalCoords();
      this.observeTriggerCoords();
      this.observeViewportElCoords();

      this.$emit('show');
    },
    onHide() {
      this.unobserveDocumentClick();
      this.unobserveDocumentCoords();
      this.unobservePortalCoords();
      this.unobserveTriggerCoords();
      this.unobserveViewportElCoords();

      this.$emit('hide');
    },
  },
};
</script>

<style lang="sass" scoped>
.fade-enter-active,
.fade-leave-active
  transition: opacity 0.2s

.fade-enter,
.fade-leave-to
  opacity: 0

.ui-dropdown
  &--self
    position: relative

  &__trigger
    cursor: pointer

.ui-dropdown-portal
  position: absolute

  $parent: &

  &--arrow
    &#{$parent}--top
      padding-bottom: 5px

    &#{$parent}--bottom
      padding-top: 5px

    &#{$parent}--left
      padding-right: 5px

    &#{$parent}--right
      padding-left: 5px

  &:not(&--no-padding)
    #{$parent}__layout
      padding: 24px

  &__layout
    box-shadow: 0px 1px 20px rgba(51, 51, 51, 0.2)
    background: #FFFFFF
    border-radius: 10px
    overflow: hidden

  &__arrow
    position: absolute
    border-color: #FFFFFF
    border-style: solid
    width: 0
    height: 0

  &--top
    #{$parent}__arrow
      bottom: 0
      border-width: 5px 10px 0 10px
      border-left-color: transparent
      border-right-color: transparent
      border-bottom-color: transparent

  &--bottom
    #{$parent}__arrow
      top: 0
      border-width: 0 10px 5px 10px
      border-left-color: transparent
      border-right-color: transparent
      border-top-color: transparent

  &--top,
  &--bottom
    &#{$parent}--stretch,
    &#{$parent}--center
      #{$parent}__arrow
        margin: auto
        left: 0
        right: 0

    &#{$parent}--start
      #{$parent}__arrow
        left: 15px

    &#{$parent}--end
      #{$parent}__arrow
        right: 15px

  &--right
    #{$parent}__arrow
      left: 0
      border-width: 10px 5px 10px 0
      border-left-color: transparent
      border-top-color: transparent
      border-bottom-color: transparent

  &--left
    #{$parent}__arrow
      right: 0
      border-width: 10px 0 10px 5px
      border-top-color: transparent
      border-right-color: transparent
      border-bottom-color: transparent

  &--right,
  &--left
    &#{$parent}--stretch
      #{$parent}__layout
        height: 100%

    &#{$parent}--stretch,
    &#{$parent}--center
      #{$parent}__arrow
        margin: auto
        top: 0
        bottom: 0

    &#{$parent}--start
      #{$parent}__arrow
        top: 15px

    &#{$parent}--end
      #{$parent}__arrow
        bottom: 15px
</style>
