import React from 'react';
import {render} from 'react-dom';
import {createStore, compose, applyMiddleware} from 'redux';
import {sagaMiddleware, KLogicProvider} from 'k-logic';
import App from './components/app';
import appReducer from './components/appReducer';

const composeEnhancers =
  typeof window === 'object' && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
        // Specify extension’s options like name, actionsBlacklist, actionsCreators, serialize...
      })
    : compose;

const store = createStore(
  appReducer,
  composeEnhancers(applyMiddleware(sagaMiddleware))
);

const run = (containerDomId, View) => {
  render(
    <KLogicProvider store={store}>
      <View />
    </KLogicProvider>,
    document.getElementById(containerDomId)
  );
};

run('root', App);

if (module.hot) {
  module.hot.accept('./components/app', () => {
    const NextApp = require('./components/app').default;
    run('root', NextApp);
  });
}
