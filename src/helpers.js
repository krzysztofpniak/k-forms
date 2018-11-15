import {
    assoc, compose,
    dissoc, omit,
} from 'ramda';
import {mapProps, withHandlers} from "recompose";

const getValue = (valueField, option) => valueField ? option[valueField] : option;

const setGeneralError = assoc('__general');

const clearGeneralError = dissoc('__general');

const addValueParam = action => (value, ...args) => {
    const actionResult = action(...args);
    return {
        ...actionResult,
        setField: {
            value
        }
    };
};

const normalizeInputChangeValue = compose(
    withHandlers({
        onChange: props => event => {
            props.onChange(!event.target ? event : props.type === 'checkbox' ? event.target.checked : event.target.value)
        },
        /*ref: props => input => {
            if (props.inputRef) {
                const hostNode = !input
                    ? null
                    : input._reactInternalInstance
                        ? input._reactInternalInstance.getHostNode()
                        : input;
                props.inputRef(hostNode);
            }
        }*/
    }),
    mapProps(props => omit(['inputRef'], props)),
);

const enhanceInputOnChange = withHandlers({
    onChange: props => value => {
        props.onChange(value, props.id);
    },
    inputRef: props => input => {
        if (props.inputRef) {
            props.inputRef(input, props.id);
        }
    }
});

export {
    getValue,
    setGeneralError,
    clearGeneralError,
    addValueParam,
    normalizeInputChangeValue,
    enhanceInputOnChange,
};
