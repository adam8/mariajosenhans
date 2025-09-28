import { FC } from 'hono/jsx';

const Nav: FC = ({ hola }) => {
  console.log('hola', hola);
  return <div>mennnnu, {hola} </div>;
};

export default Nav;