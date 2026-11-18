"use strict";

(() => {
  const form = document.querySelector("#contact-form");
  const formContent = document.querySelector("#form-content");
  const fieldset = document.querySelector("#form-fields");
  const success = document.querySelector("#form-success");
  const successTitle = document.querySelector("#success-title");
  const formStatus = document.querySelector("#form-status");
  const submitLabel = document.querySelector("#submit-label");
  const consentVersion = form.dataset.consentVersion;
  const fields = ["name", "email", "phone", "message"];
  if (consentVersion) {
    fields.push("consent");
    document.querySelector("#form-privacy").hidden = false;
    document.querySelector("#form-notice").textContent = "Оставьте контакты, чтобы мы могли ответить на вашу заявку.";
  }

  const errorMessages = {
    name: "Пожалуйста, укажите ваше имя.",
    email: "Укажите email в формате name@company.ru.",
    phone: "Укажите телефон, например +7 (999) 123-45-67.",
    message: "Расскажите немного о вашей задаче.",
    consent: "Отметьте согласие, чтобы отправить заявку.",
  };
  const failureMessage = "Не удалось подтвердить отправку. Попробуйте ещё раз.";
  let sending = false;

  function showFieldError(field, invalid) {
    document.querySelector("#" + field.id + "-error").textContent = invalid ? errorMessages[field.name] : "";
    if (invalid) field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
  }

  function validateField(field) {
    const value = field.value.trim();
    let valid = field.type === "checkbox" ? field.checked : (!field.required || Boolean(value));
    if (field.type === "email") valid &&= field.validity.valid;
    if (field.type === "tel" && value) {
      const digits = value.replace(/\D/g, "").length;
      valid &&= /^\+?[\d() .-]+$/.test(value) && digits >= 7 && digits <= 15;
    }
    showFieldError(field, !valid);
    return valid;
  }

  const inputs = fields.map(name => form.elements.namedItem(name));
  inputs.forEach(field => {
    field.addEventListener("blur", () => {
      if (field.type !== "checkbox" && (field.value || field.hasAttribute("aria-invalid"))) validateField(field);
    });
    field.addEventListener("input", () => {
      if (field.hasAttribute("aria-invalid")) validateField(field);
      formStatus.textContent = "";
    });
  });

  function showSuccess() {
    form.reset();
    if (consentVersion) {
      successTitle.textContent = "Заявка отправлена";
      document.querySelector("#success-description").textContent = "Спасибо! Ответим на указанный email.";
    }
    formStatus.textContent = "";
    formContent.hidden = true;
    success.hidden = false;
    successTitle.focus({ preventScroll: true });
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (sending) return;
    const invalidFields = inputs.filter(field => !validateField(field));
    if (invalidFields.length) {
      formStatus.textContent = "Проверьте отмеченные поля формы.";
      invalidFields[0].focus();
      return;
    }

    if (!consentVersion) {
      showSuccess();
      return;
    }

    const payload = Object.fromEntries(new FormData(form));
    for (const name of ["name", "email", "phone", "message"]) payload[name] = payload[name].trim();
    payload.consent = form.elements.namedItem("consent").checked;
    payload.consentVersion = consentVersion;
    sending = true;
    fieldset.disabled = true;
    formStatus.textContent = "";
    submitLabel.textContent = "Отправляем…";

    let focusField;
    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25_000),
      });
      const result = await response.json();
      if (response.ok && result.ok === true) {
        showSuccess();
      } else if (response.status === 429) {
        const minutes = Math.max(1, Math.ceil(Number(response.headers.get("Retry-After")) / 60));
        formStatus.textContent = "Слишком много попыток. Повторите через " + minutes + " мин.";
      } else if (result.code === "consent_updated") {
        formStatus.textContent = "Текст согласия обновился. Скопируйте описание задачи и обновите страницу.";
      } else if (Array.isArray(result.fields)) {
        const invalid = inputs.filter(field => result.fields.includes(field.name));
        invalid.forEach(field => showFieldError(field, true));
        focusField = invalid[0];
        formStatus.textContent = "Проверьте отмеченные поля формы.";
      } else {
        formStatus.textContent = failureMessage;
      }
    } catch {
      formStatus.textContent = failureMessage;
    } finally {
      sending = false;
      fieldset.disabled = false;
      submitLabel.textContent = "Отправить";
      focusField?.focus();
    }
  });

  document.querySelector("#reset-form").addEventListener("click", () => {
    success.hidden = true;
    formContent.hidden = false;
    formStatus.textContent = "";
    inputs.forEach(field => showFieldError(field, false));
    inputs[0].focus({ preventScroll: true });
  });

  // The no-script form stays disabled.
  fieldset.disabled = false;
  window.addEventListener("pageshow", event => {
    if (event.persisted && !sending) form.reset();
  });
})();
