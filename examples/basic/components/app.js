import React from 'react';
import {KForm, Form2} from '../../../src/main';
import {required} from '../../../src/validators';
import {createReducer, actionType2} from 'k-reducer';
import {Scope, withScope, useKReducer} from 'k-logic';
import {compose, over, lensProp, add} from 'ramda';
import {withHandlers, setStatic} from 'recompose';

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

const counterReducer = createReducer({counter: 0}, [
  actionType2('INC', over(lensProp('counter'), add(1))),
]);

const counterActions = {
  inc: () => ({type: 'INC'}),
};

const Expand = withScope(() => {
  const {counter, inc} = useKReducer(counterReducer, counterActions);
  return (
    <button onClick={inc} type="button">
      {`Hopla ${counter}`}
    </button>
  );
});

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
    id: 'surname',
    label: 'Surname',
    defaultValue: '',
    validate: required,
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

const Row = ({input, label, error}) => (
  <div style={{border: 'solid red 1px'}}>
    <div>{label}</div>
    <div>{input}</div>
    <div>{error}</div>
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
    <div>pierwszy form</div>
    <Form2 scope="form0" schema={schema1} fieldTypes={fieldTypes} />
    <div>drugi form</div>
    <Form2
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
