import React from 'react'
import {Label} from "@/components/ui/label";
import {Input} from "@/components/ui/input";
import {cn} from "@/lib/utils";

interface InputFieldProps extends FormInputProps {
    onFocus?: () => void;
    onBlur?: () => void;
}

const InputField = ({ name, label, placeholder, type = "text", register, error, validation, disabled, value, onFocus, onBlur }: InputFieldProps) => {
    return (
        <div className="space-y-2">
            <Label htmlFor={name} className="form-label">
                {label}
            </Label>
            <Input
                type={type}
                id={name}
                placeholder={placeholder}
                disabled={disabled}
                value={value}
                className={cn('form-input', { 'opacity-50 cursor-not-allowed': disabled })}
                onFocus={onFocus}
                onBlur={onBlur}
                {...register(name, validation)}
            />
            {error && <p className="text-sm text-red-500">{error.message}</p>}
        </div>
    )
}
export default InputField
