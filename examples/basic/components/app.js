import React from 'react';
import {KForm, Form} from '../../../src/main';
import {required} from '../../../src/validators';
import {createReducer, actionType2} from 'k-reducer';
import {Scope, withScope, useKReducer} from 'k-logic';
import {compose, over, lensProp, add} from 'ramda';
import {withHandlers, setStatic} from 'recompose';

const schema2 = [
  {
    id: 'name',
    title: 'Name',
  },
  {
    id: 'age',
    title: 'Age',
    defaultValue: '10',
  },
];

const counterReducer = createReducer({counter: 0}, [
  actionType2('INC', over(lensProp('counter'), add(1))),
]);

const counterActions = {
  inc: () => ({type: 'INC'}),
};

const Expand = withScope(({color}) => {
  const {counter, inc} = useKReducer(counterReducer, counterActions);
  return (
    <button
      style={{backgroundColor: color || 'white'}}
      onClick={inc}
      type="button"
    >
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
    title: 'Name',
    defaultValue: 'Jaśko',
  },
  {
    id: 'surname',
    title: 'Surname',
    defaultValue: '',
    validate: required,
  },
  {
    id: 'job',
    title: 'Job',
    type: 'expand',
  },
  {
    id: 'job2',
    title: 'Job 2',
    type: 'expand',
    props: () => ({color: 'red'}),
  },
];

const Row = ({input, title, error}) => (
  <div style={{border: 'solid red 1px'}}>
    <div>{title}</div>
    <div>{input}</div>
    <div>{error}</div>
  </div>
);

const FormTemplate = ({buttons, fields}) => (
  <div>
    {buttons}
    {fields.default}
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
    <Form scope="form0" schema={schema1} fieldTypes={fieldTypes} />
    <div>drugi form</div>
    <Form
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
