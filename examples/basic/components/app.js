import React from 'react';
import {KForm} from '../../../src/main';
import {createReducer} from 'k-reducer';
import {withLogic} from 'k-logic';

const Scope = withLogic({reducer: () => createReducer({}, [])})(
  ({children}) => <div>{children}</div>
);

const schema1 = [
  {
    id: 'name',
    label: 'Name',
  },
  {
    id: 'age',
    label: 'Age',
    defaultValue: '10',
  },
];

const schema2 = [
  {
    id: 'job',
    label: 'Job',
  },
];

const App = () => (
  <Scope scope="app">
    <KForm scope="form1" schema={schema1} />
    <KForm scope="form2" schema={schema2} />
  </Scope>
);

export default App;
