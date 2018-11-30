import React from 'react';
import {KForm} from '../../../src/main';
import {createReducer, actionType2} from 'k-reducer';
import {withLogic} from 'k-logic';
import {compose, over, lensProp, add} from 'ramda';
import {withHandlers, setStatic} from 'recompose';

const Scope = withLogic({reducer: () => createReducer({}, [])})(
  ({children}) => <div>{children}</div>
);

const schema2 = [
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

const Expand = compose(
  withLogic({
    reducer: () =>
      createReducer({counter: 0}, [
        actionType2('INC', over(lensProp('counter'), add(1))),
      ]),
  }),
  withHandlers({
    onClick: props => e => props.dispatch({type: 'INC'}),
  })
)(({children, counter, onClick}) => (
  <button onClick={onClick} type="button">
    {`Hopla ${counter}`}
  </button>
));

const fieldTypes = {
  text: ({value, onChange}) => <input value={value} onChange={onChange} />,
  expand: Expand,
};

const schema1 = [
  {
    id: 'name',
    label: 'Name',
    defaultValue: 'Jaśko',
  },
  {
    id: 'job',
    label: 'Job',
    type: 'expand',
  },
  {
    id: 'job2',
    label: 'Job 2',
    type: 'expand',
  },
];

const Row = ({input, label}) => (
  <div style={{border: 'solid red 1px'}}>
    <div>{label}</div>
    <div>{input}</div>
  </div>
);

const FormTemplate = ({buttons, fields}) => (
  <div>
    {buttons}
    {fields}
    {buttons}
  </div>
);

const Button = ({submit, onReset}) => (
  <div>
    <button onClick={submit}>Zatwierdź</button>
  </div>
);

const App = () => (
  <Scope scope="app">
    <KForm scope="form1" schema={schema1} fieldTypes={fieldTypes} />
    <div>Drugi form</div>
    <KForm
      scope="form2"
      schema={schema2}
      fieldTypes={fieldTypes}
      formGroupTemplate={Row}
      formTemplate={FormTemplate}
      buttonsTemplate={Button}
    />
  </Scope>
);

export default App;
