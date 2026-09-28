const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function loadModule(file) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}

(async () => {
    const { describeWeatherCode, weatherIconKind } = await loadModule('src/features/live-weather.js');
    assert.equal(describeWeatherCode(0, 1), '晴朗');
    assert.equal(describeWeatherCode(0, 0), '晴夜');
    assert.equal(describeWeatherCode(61, 1), '有雨');
    assert.equal(describeWeatherCode(95, 1), '雷雨');
    assert.equal(weatherIconKind(0, 0), 'moon');
    assert.equal(weatherIconKind(2, 1), 'partly-cloudy');
    assert.equal(weatherIconKind(73, 1), 'snow');
    console.log('live weather code mapping: ok');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
