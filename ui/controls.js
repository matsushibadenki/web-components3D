let nextControlId = 0;

class AlloyControl extends HTMLElement {
  connectedCallback() {
    if (this.input) return;
    this.input = document.createElement('input');
    this.input.type = 'range';
    this.input.min = 0;
    this.input.max = 100;
    this.input.value = this.getAttribute('value') ?? 50;
    this.input.id = `alloy-${++nextControlId}`;

    this.caption = document.createElement('label');
    this.caption.htmlFor = this.input.id;
    this.label = this.getAttribute('label') ?? '';
    this.output = document.createElement('output');
    this.output.htmlFor = this.input.id;
    this.face = document.createElement('div');
    this.face.className = 'face';
    this.append(this.caption, this.face, this.output);
    this.face.append(this.input);
    this.input.addEventListener('input', () => this.paint());
    this.paint();
  }

  set label(value) {
    this.caption.textContent = value;
  }

  set value(value) {
    this.input.value = value;
    this.paint();
  }

  get value() {
    return this.input.valueAsNumber;
  }

  paint() {
    this.style.setProperty('--level', this.value / 100);
    this.output.value = String(this.value).padStart(2, '0');
  }
}

class AlloyKnob extends AlloyControl {
  connectedCallback() {
    if (this.input) return;
    super.connectedCallback();
    const ticks = document.createElement('div');
    ticks.className = 'ticks';
    ticks.setAttribute('aria-hidden', 'true');
    this.ticks = [];
    for (let index = 0; index <= 20; index++) {
      const tick = document.createElement('i');
      tick.style.setProperty('--angle', `${-135 + index * 13.5}deg`);
      ticks.append(tick);
      this.ticks.push(tick);
    }
    const dial = document.createElement('span');
    dial.className = 'dial';
    this.face.prepend(ticks, dial);
    this.paint();

    let drag;
    this.input.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      this.input.focus();
      this.input.setPointerCapture(event.pointerId);
      drag = { id: event.pointerId, y: event.clientY, value: this.value };
    });
    this.input.addEventListener('pointermove', event => {
      if (drag?.id !== event.pointerId) return;
      const value = Math.min(100, Math.max(0, Math.round(drag.value + (drag.y - event.clientY) * (event.shiftKey ? .2 : .7))));
      if (value === this.value) return;
      this.value = value;
      this.input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    this.input.addEventListener('lostpointercapture', () => { drag = undefined; });
  }

  paint() {
    super.paint();
    this.ticks?.forEach((tick, index) => {
      tick.classList.toggle('lit', this.value > 0 && index * 5 <= this.value);
    });
  }
}

class AlloyFader extends AlloyControl {
  connectedCallback() {
    if (this.input) return;
    super.connectedCallback();

    const thumb = document.createElement('span');
    thumb.className = 'fader-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    this.face.append(thumb);

    let drag;
    thumb.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || drag) return;
      event.preventDefault();
      this.input.focus();
      thumb.setPointerCapture(event.pointerId);
      const vertical = this.dataset.axis === 'vertical';
      const track = this.face.getBoundingClientRect();
      const grip = thumb.getBoundingClientRect();
      drag = {
        id: event.pointerId,
        vertical,
        position: vertical ? -event.clientY : event.clientX,
        travel: Math.max(1, vertical ? track.height - grip.height : track.width - grip.width),
        value: this.value,
      };
    });
    thumb.addEventListener('pointermove', event => {
      if (event.pointerId !== drag?.id || !(event.buttons & 1)) return;
      const position = drag.vertical ? -event.clientY : event.clientX;
      const value = Math.max(0, Math.min(100, Math.round(drag.value + (position - drag.position) / drag.travel * 100)));
      if (this.value === value) return;
      this.value = value;
      this.input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      thumb.addEventListener(type, event => {
        if (event.pointerId === drag?.id) drag = undefined;
      });
    }
  }
}

class AlloySwitch extends HTMLElement {
  connectedCallback() {
    if (this.button) return;
    this.caption = document.createElement('span');
    this.caption.id = `alloy-${++nextControlId}`;
    this.label = this.getAttribute('label') ?? '';
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.setAttribute('role', 'switch');
    this.button.setAttribute('aria-labelledby', this.caption.id);
    this.button.className = 'rocker';
    this.button.append(document.createElement('span'));
    this.append(this.caption, this.button);
    this.value = this.getAttribute('value') === 'true';
    this.button.addEventListener('click', () => {
      this.value = !this.value;
      this.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  set label(value) {
    this.caption.textContent = value;
  }

  set value(value) {
    this.button.setAttribute('aria-checked', String(value));
  }

  get value() {
    return this.button.getAttribute('aria-checked') === 'true';
  }
}

class AlloyPushButton extends HTMLElement {
  connectedCallback() {
    if (this.button) return;
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.label = this.getAttribute('label') ?? 'Push';
    this.append(this.button);
  }

  set label(value) {
    if (this.dataset.shape === 'round') {
      this.button.setAttribute('aria-label', value);
      this.button.title = value;
    } else {
      this.button.textContent = value;
    }
  }
}

customElements.define('alloy-push-button', AlloyPushButton);
customElements.define('alloy-knob', AlloyKnob);
customElements.define('alloy-fader', AlloyFader);
customElements.define('alloy-switch', AlloySwitch);
