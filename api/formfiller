// Shared helpers for automating the eservicii.gov.md application form
// and scanning the exam-date calendar widget.

const MONTHS = {
  'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3, 'мая': 4, 'июня': 5,
  'июля': 6, 'августа': 7, 'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11,
};

export function parseAriaDate(label) {
  if (!label) return null;
  const m = label.match(/(\d{1,2})\s+([а-яёА-ЯЁ]+)\s+(\d{4})/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const monthName = m[2].toLowerCase();
  const year = parseInt(m[3], 10);
  if (!(monthName in MONTHS)) return null;
  return new Date(Date.UTC(year, MONTHS[monthName], day));
}

// Sets a value on an <input>/<textarea> found via its associated <label> text,
// dispatching input/change events so Blazor's data binding picks it up.
export async function fillFieldByLabel(page, labelText, value) {
  if (!value) return false;
  return page.evaluate(({ labelText, value }) => {
    const norm = (s) => s.trim().replace(/\*\s*$/, '').trim();
    const labels = Array.from(document.querySelectorAll('label'));
    const label = labels.find((l) => norm(l.textContent) === labelText);
    if (!label) return false;

    let input = label.htmlFor ? document.getElementById(label.htmlFor) : null;
    if (!input) {
      const parent = label.closest('div');
      input = parent ? parent.querySelector('input, textarea') : null;
    }
    if (!input) return false;

    const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    input.focus();
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
    return true;
  }, { labelText, value });
}

// Opens a custom dropdown found near its <label> and clicks the option
// whose visible text matches optionText exactly.
export async function selectDropdownByLabel(page, labelText, optionText) {
  if (!optionText) return false;

  const opened = await page.evaluate((labelText) => {
    const norm = (s) => s.trim().replace(/\*\s*$/, '').trim();
    const labels = Array.from(document.querySelectorAll('label'));
    const label = labels.find((l) => norm(l.textContent) === labelText);
    if (!label) return false;

    const container = label.closest('div');
    let trigger = container
      ? container.querySelector('[role="combobox"], select, .dropdown-toggle, .rz-dropdown, .mud-select-input, input')
      : null;
    if (!trigger) trigger = label.nextElementSibling;
    if (!trigger) return false;

    trigger.scrollIntoView({ block: 'center' });
    trigger.click();
    return true;
  }, labelText);

  if (!opened) return false;
  await new Promise((r) => setTimeout(r, 600));

  return page.evaluate((optionText) => {
    const candidates = Array.from(document.querySelectorAll('li, [role="option"], .dropdown-item, option'));
    const match = candidates.find((el) => el.textContent.trim() === optionText);
    if (match) {
      match.click();
      return true;
    }
    return false;
  }, optionText);
}

export async function clickButtonByText(page, text) {
  return page.evaluate((text) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) => b.textContent.trim().toUpperCase() === text.toUpperCase());
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
    return false;
  }, text);
}

// Walks through both screens of the eservicii.gov.md application form.
// Every step is best-effort: if a field/label isn't found, it's silently skipped
// rather than throwing, so partially-known forms still get as far as possible.
export async function fillApplicationForm(page, profile, { onStep } = {}) {
  const step = async (label) => {
    if (onStep) await onStep(label);
  };

  await page.waitForSelector('label', { timeout: 20000 }).catch(() => {});
  await step('loaded');

  // Screen 1: Данные заказчика
  await fillFieldByLabel(page, 'IDNP', profile.idnp);
  await fillFieldByLabel(page, 'Фамилия', profile.lastName);
  await fillFieldByLabel(page, 'Имя', profile.firstName);
  await fillFieldByLabel(page, 'Телефон', profile.phone);
  await fillFieldByLabel(page, 'Электронная почта', profile.email);

  // Tick the mandatory personal-data consent checkbox (last checkbox on the page)
  await page.evaluate(() => {
    const boxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    const consent = boxes[boxes.length - 1];
    if (consent && !consent.checked) consent.click();
  });
  await step('filled-step1');

  await new Promise((r) => setTimeout(r, 300));
  await clickButtonByText(page, 'ПРОДОЛЖИТЬ');
  await new Promise((r) => setTimeout(r, 1500));
  await step('after-continue');

  // Screen 2: Мои документы + Запрошенные услуги
  await fillFieldByLabel(page, 'Удостоверение личности/ вид на жительство', profile.idDocument);
  await fillFieldByLabel(page, 'Дата выдачи', profile.idDocumentDate);
  await fillFieldByLabel(page, 'Медицинская справка', profile.medicalCert);
  await step('filled-documents');

  await selectDropdownByLabel(page, 'Выберите услугу', profile.service);
  await new Promise((r) => setTimeout(r, 400));
  await selectDropdownByLabel(page, 'Выберите категорию', profile.category);
  await new Promise((r) => setTimeout(r, 400));
  await selectDropdownByLabel(page, 'Выберите причину обращения', profile.reason);
  await new Promise((r) => setTimeout(r, 400));
  await selectDropdownByLabel(page, 'Выберите пункт сдачи экзамена', profile.location);
  await new Promise((r) => setTimeout(r, 800));
  await step('filled-dropdowns');
}

export async function scanVisibleDays(page) {
  return page.evaluate(() => {
    const picker = document.querySelector('.fod-picker-calendar');
    if (!picker) return [];
    return Array.from(picker.querySelectorAll('button.fod-picker-calendar-day'))
      .filter((b) => !b.disabled)
      .map((b) => b.getAttribute('aria-label'))
      .filter(Boolean);
  });
}

export async function clickNextMonth(page) {
  return page.evaluate(() => {
    const btn = document.querySelector('.fod-picker-nav-button-next');
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
    return false;
  });
}

export async function findEarliestAvailable(page, maxMonthsForward = 6) {
  for (let i = 0; i < maxMonthsForward; i++) {
    const labels = await scanVisibleDays(page);
    const parsed = labels
      .map((label) => ({ label, date: parseAriaDate(label) }))
      .filter((d) => d.date)
      .sort((a, b) => a.date - b.date);
    if (parsed.length > 0) return parsed[0];

    const moved = await clickNextMonth(page);
    if (!moved) break;
    await new Promise((r) => setTimeout(r, 900));
  }
  return null;
}

export function launchOptions(chromium) {
  return {
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    headless: chromium.headless,
  };
}
