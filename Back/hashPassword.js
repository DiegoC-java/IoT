const bcrypt = require('bcrypt');



async function hashPassword(password) {
    try {
        const saltRounds = 10;
        const hash = await bcrypt.hash(password, saltRounds);
        console.log('\n🔐 Hash generado:');
        console.log(hash);
        console.log('\n📋 Para usar en SQL:');
        console.log(`'${hash}'`);
        return hash;
    } catch (error) {
        console.error('Error generando hash:', error);
    }
}

async function testPassword(password, hash) {
    try {
        const match = await bcrypt.compare(password, hash);
        console.log(`\n✅ Verificación: ${match ? 'CORRECTO' : 'INCORRECTO'}`);
        return match;
    } catch (error) {
        console.error('Error verificando contraseña:', error);
    }
}


if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('\n📖 Uso:');
        console.log('  node hashPassword.js <contraseña>');
        console.log('  node hashPassword.js <contraseña> <hash>  (para verificar)');
        console.log('\n📝 Ejemplos:');
        console.log('  node hashPassword.js admin123');
        console.log('  node hashPassword.js admin123 $2b$10$...');
        process.exit(0);
    }
    
    const password = args[0];
    const hashToTest = args[1];
    
    if (hashToTest) {
        // Modo verificación
        console.log(`\n🔍 Verificando contraseña: "${password}"`);
        testPassword(password, hashToTest);
    } else {
        // Modo generación
        console.log(`\n🔒 Generando hash para: "${password}"`);
        hashPassword(password);
    }
}

module.exports = { hashPassword, testPassword };
