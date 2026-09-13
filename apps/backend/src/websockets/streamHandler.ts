export function handleStreamConnection(connection: { on: Function }) {
  connection.on('message', (message: unknown) => {
    void message;
  });
}
