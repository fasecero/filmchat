import { TextInput, type TextInputProps, StyleSheet } from 'react-native';

export function InputField(props: TextInputProps) {
  return <TextInput {...props} placeholderTextColor="#718096" style={styles.input} />;
}

const styles = StyleSheet.create({
  input: {
    borderColor: '#CBD5E0',
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 12,
    padding: 14,
  },
});